/**
 * Remove Venue Rental payments imported via VENUE_RENTAL_PAYMENTS_V1, then mark
 * past (ended) non-cancelled rentals as completed.
 *
 * Usage (dry-run by default):
 *   node scripts/cleanup-imported-venue-rental-payments.mjs
 *   node scripts/cleanup-imported-venue-rental-payments.mjs --execute
 *   node scripts/cleanup-imported-venue-rental-payments.mjs --org-id <uuid> --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL for --execute.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "VENUE_RENTAL_PAYMENTS_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"

const CANCELLED_STATUSES = new Set([
  "cancelled_before_payment",
  "cancelled_after_payment",
  "declined",
])

const TERMINAL_KEEP_STATUSES = new Set([
  "completed",
  "closed",
  "security_deposit_refunded",
  "awaiting_security_deposit_refund_approval",
])

function loadEnvLocal() {
  const path = resolve(root, ".env.local")
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

function parseArgs(argv) {
  const args = { execute: false, orgId: DEFAULT_ORG_ID }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--execute") args.execute = true
    else if (argv[i] === "--org-id") args.orgId = argv[++i]
  }
  return args
}

function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const sb = createClient(url, key, { auth: { persistSession: false } })
  const nowIso = new Date().toISOString()

  const report = {
    importTag: IMPORT_TAG,
    mode: args.execute ? "execute" : "dry-run",
    orgId: args.orgId,
    nowIso,
    importedPaymentsFound: 0,
    importedPaymentsDeleted: 0,
    pastRentalsFound: 0,
    pastRentalsMarkedCompleted: 0,
    pastRentalsAlreadyCompleted: 0,
    pastRentalsCancelledSkipped: 0,
    futureRentalsResetAfterImport: 0,
    errors: [],
    sampleDeletedPayments: [],
    sampleCompletedRentals: [],
  }

  // 1) Find imported payment rows
  const { data: importedPayments, error: paymentsError } = await sb
    .from("rental_payments")
    .select("id, venue_rental_id, amount, payment_type, status, notes, paid_at")
    .eq("organization_id", args.orgId)
    .ilike("notes", `%[${IMPORT_TAG}:%`)

  if (paymentsError) {
    throw new Error(paymentsError.message)
  }

  const paymentRows = importedPayments || []
  report.importedPaymentsFound = paymentRows.length
  report.sampleDeletedPayments = paymentRows.slice(0, 12).map((row) => ({
    id: row.id,
    venueRentalId: row.venue_rental_id,
    amount: row.amount,
    paymentType: row.payment_type,
    status: row.status,
    paidAt: row.paid_at,
  }))

  const rentalsTouchedByImport = new Set(
    paymentRows.map((row) => row.venue_rental_id).filter(Boolean)
  )

  if (args.execute && paymentRows.length > 0) {
    for (const ids of chunk(
      paymentRows.map((row) => row.id),
      100
    )) {
      const { error } = await sb
        .from("rental_payments")
        .delete()
        .eq("organization_id", args.orgId)
        .in("id", ids)
      if (error) {
        report.errors.push(`delete payments: ${error.message}`)
      } else {
        report.importedPaymentsDeleted += ids.length
      }
    }
  }

  // 2) Load rentals + latest reservation end for "past" detection
  const { data: rentals, error: rentalsError } = await sb
    .from("venue_rentals")
    .select("id, status")
    .eq("organization_id", args.orgId)

  if (rentalsError) {
    throw new Error(rentalsError.message)
  }

  const rentalIds = (rentals || []).map((row) => row.id)
  const endByRental = new Map()

  for (const ids of chunk(rentalIds, 200)) {
    const { data: reservations, error: reservationError } = await sb
      .from("rental_reservations")
      .select("venue_rental_id, end_at")
      .eq("organization_id", args.orgId)
      .in("venue_rental_id", ids)

    if (reservationError) {
      throw new Error(reservationError.message)
    }

    for (const row of reservations || []) {
      const current = endByRental.get(row.venue_rental_id)
      if (!current || row.end_at > current) {
        endByRental.set(row.venue_rental_id, row.end_at)
      }
    }
  }

  const pastToComplete = []
  const futureToReset = []

  for (const rental of rentals || []) {
    const endAt = endByRental.get(rental.id)
    const isPast = Boolean(endAt && endAt < nowIso)

    if (CANCELLED_STATUSES.has(rental.status)) {
      if (isPast) report.pastRentalsCancelledSkipped += 1
      continue
    }

    if (isPast) {
      report.pastRentalsFound += 1
      if (
        rental.status === "completed" ||
        TERMINAL_KEEP_STATUSES.has(rental.status)
      ) {
        report.pastRentalsAlreadyCompleted += 1
        continue
      }
      pastToComplete.push(rental)
      continue
    }

    // Future rentals that only got deposit_paid from the bad import → reopen for payment
    if (
      rentalsTouchedByImport.has(rental.id) &&
      (rental.status === "deposit_paid" ||
        rental.status === "security_deposit_paid")
    ) {
      futureToReset.push(rental)
    }
  }

  report.sampleCompletedRentals = pastToComplete.slice(0, 12).map((row) => ({
    id: row.id,
    fromStatus: row.status,
    endAt: endByRental.get(row.id) || null,
  }))

  if (args.execute) {
    for (const ids of chunk(
      pastToComplete.map((row) => row.id),
      100
    )) {
      const { error } = await sb
        .from("venue_rentals")
        .update({
          status: "completed",
          closed_at: nowIso,
        })
        .eq("organization_id", args.orgId)
        .in("id", ids)

      if (error) {
        report.errors.push(`complete past rentals: ${error.message}`)
      } else {
        report.pastRentalsMarkedCompleted += ids.length
      }

      const { error: reservationError } = await sb
        .from("rental_reservations")
        .update({
          status: "confirmed",
          hold_expires_at: null,
        })
        .eq("organization_id", args.orgId)
        .in("venue_rental_id", ids)
        .neq("status", "cancelled")

      if (reservationError) {
        report.errors.push(`confirm past reservations: ${reservationError.message}`)
      }
    }

    for (const ids of chunk(
      futureToReset.map((row) => row.id),
      100
    )) {
      const { error } = await sb
        .from("venue_rentals")
        .update({ status: "approved_pending_payment" })
        .eq("organization_id", args.orgId)
        .in("id", ids)

      if (error) {
        report.errors.push(`reset future rentals: ${error.message}`)
      } else {
        report.futureRentalsResetAfterImport += ids.length
      }
    }
  } else {
    report.importedPaymentsDeleted = 0
    report.pastRentalsMarkedCompleted = pastToComplete.length
    report.futureRentalsResetAfterImport = futureToReset.length
  }

  const reportsDir = resolve(root, "scripts/reports")
  mkdirSync(reportsDir, { recursive: true })
  const outPath = resolve(
    reportsDir,
    args.execute
      ? "cleanup-imported-venue-rental-payments-execute.json"
      : "cleanup-imported-venue-rental-payments-dry-run.json"
  )
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log(`\nWrote ${outPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

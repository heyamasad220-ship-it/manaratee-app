/**
 * Import Venue Rental Payments.csv → rental_payments on matched venue_rentals.
 *
 * Matching: customer email / phone → billing contact (or Google Form notes email).
 * If the contact has multiple rentals, pick the one whose event start is closest
 * to the payment date (prefer event on/after payment).
 * No match → skip.
 *
 * Usage (dry-run by default):
 *   node scripts/import-venue-rental-payments.mjs
 *   node scripts/import-venue-rental-payments.mjs --csv "C:/Users/danan/Downloads/Venue Rental Payments.csv"
 *   node scripts/import-venue-rental-payments.mjs --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL for --execute.
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import Papa from "papaparse"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "VENUE_RENTAL_PAYMENTS_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const DEFAULT_CSV = "C:/Users/danan/Downloads/Venue Rental Payments.csv"
const FORM_IMPORT_TAG = "VENUE_RENTAL_GOOGLE_FORM_V1"

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
  const args = {
    csv: DEFAULT_CSV,
    execute: false,
    orgId: DEFAULT_ORG_ID,
    limit: null,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--execute") args.execute = true
    else if (arg === "--csv") args.csv = argv[++i]
    else if (arg === "--org-id") args.orgId = argv[++i]
    else if (arg === "--limit") args.limit = Number(argv[++i])
  }
  return args
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase()
}

function normalizePhone(value) {
  let digits = normalizeText(value).replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1)
  }
  return digits
}

function parseUsDate(value) {
  const text = normalizeText(value)
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  const year = Number(match[3])
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

function paymentKey(row) {
  return createHash("sha256")
    .update(
      [
        IMPORT_TAG,
        normalizeEmail(row.email),
        normalizePhone(row.phone),
        row.paidAtIso || "",
        String(row.amount),
        row.csvStatus,
      ].join("|")
    )
    .digest("hex")
    .slice(0, 24)
}

function parseCsv(csvPath) {
  const text = readFileSync(csvPath, "utf8")
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  })
  const rows = []
  for (const raw of parsed.data || []) {
    const email = normalizeEmail(raw["Customer Email"])
    const phone = normalizePhone(raw["Customer Phone"])
    const amount = Number(String(raw.Amount ?? "").replace(/,/g, ""))
    const csvStatus = normalizeText(raw.Status).toLowerCase()
    const paidAt = parseUsDate(raw["Transaction Date"])
    if (!Number.isFinite(amount) || amount === 0) continue
    if (!paidAt) continue
    if (csvStatus !== "succeeded" && csvStatus !== "refunded") continue

    rows.push({
      customerName: normalizeText(raw["Customer Name"]) || null,
      email: email || null,
      phone: phone || null,
      amount,
      absAmount: Math.abs(amount),
      csvStatus,
      paidAt,
      paidAtIso: paidAt.toISOString(),
      isRefund: csvStatus === "refunded" || amount < 0,
    })
  }
  return rows
}

function scoreRental(rental, paymentMs) {
  const startMs = rental.eventStartMs
  if (!Number.isFinite(startMs)) return Number.POSITIVE_INFINITY
  // Prefer events on/after payment; otherwise absolute distance
  if (startMs >= paymentMs) return startMs - paymentMs
  return paymentMs - startMs + 365 * 24 * 60 * 60 * 1000
}

function pickRental(candidates, paymentMs) {
  if (!candidates.length) return null
  const active = candidates.filter(
    (r) =>
      !["cancelled_before_payment", "cancelled_after_payment", "declined"].includes(
        r.status
      )
  )
  const pool = active.length ? active : candidates
  return [...pool].sort(
    (a, b) => scoreRental(a, paymentMs) - scoreRental(b, paymentMs)
  )[0]
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))

  if (!existsSync(args.csv)) {
    console.error(`CSV not found: ${args.csv}`)
    process.exit(1)
  }

  let payments = parseCsv(args.csv)
  if (args.limit && Number.isFinite(args.limit)) {
    payments = payments.slice(0, args.limit)
  }

  for (const row of payments) {
    row.importKey = paymentKey(row)
  }

  const report = {
    importTag: IMPORT_TAG,
    mode: args.execute ? "execute" : "dry-run",
    orgId: args.orgId,
    csv: args.csv,
    paymentRows: payments.length,
    matched: 0,
    skippedNoBooking: 0,
    skippedAlreadyImported: 0,
    paymentsCreated: 0,
    rentalsStatusUpdated: 0,
    errors: [],
    unmatchedSamples: [],
    matchedSamples: [],
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: rentals, error: rentalsError } = await sb
    .from("venue_rentals")
    .select("id, status, notes, billing_contact_id, created_at")
    .eq("organization_id", args.orgId)

  if (rentalsError) throw new Error(rentalsError.message)

  const rentalIds = (rentals || []).map((r) => r.id)
  const contactIds = [
    ...new Set(
      (rentals || []).map((r) => r.billing_contact_id).filter(Boolean)
    ),
  ]

  const [{ data: contacts }, { data: reservations }, { data: existingPayments }] =
    await Promise.all([
      contactIds.length
        ? sb
            .from("contacts")
            .select("id, full_name, email, phone")
            .eq("organization_id", args.orgId)
            .in("id", contactIds)
        : Promise.resolve({ data: [] }),
      rentalIds.length
        ? sb
            .from("rental_reservations")
            .select("venue_rental_id, start_at")
            .eq("organization_id", args.orgId)
            .in("venue_rental_id", rentalIds)
            .order("start_at", { ascending: true })
        : Promise.resolve({ data: [] }),
      sb
        .from("rental_payments")
        .select("id, notes, venue_rental_id")
        .eq("organization_id", args.orgId)
        .ilike("notes", `%${IMPORT_TAG}%`),
    ])

  const contactById = new Map((contacts || []).map((c) => [c.id, c]))
  const earliestStartByRental = new Map()
  for (const row of reservations || []) {
    if (!earliestStartByRental.has(row.venue_rental_id)) {
      earliestStartByRental.set(
        row.venue_rental_id,
        new Date(row.start_at).getTime()
      )
    }
  }

  const importedKeys = new Set()
  for (const payment of existingPayments || []) {
    const match = String(payment.notes || "").match(
      new RegExp(`${IMPORT_TAG}:([a-f0-9]{24})`)
    )
    if (match) importedKeys.add(match[1])
  }

  /** @type {Map<string, object[]>} */
  const byEmail = new Map()
  /** @type {Map<string, object[]>} */
  const byPhone = new Map()

  function remember(map, key, rental) {
    if (!key) return
    const list = map.get(key) || []
    list.push(rental)
    map.set(key, list)
  }

  const enriched = (rentals || []).map((rental) => {
    const contact = rental.billing_contact_id
      ? contactById.get(rental.billing_contact_id)
      : null
    const notes = String(rental.notes || "")
    const notesEmailMatch = notes.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
    )
    const email =
      normalizeEmail(contact?.email) ||
      (notesEmailMatch ? normalizeEmail(notesEmailMatch[0]) : "")
    const phone = normalizePhone(contact?.phone)
    const row = {
      id: rental.id,
      status: rental.status,
      eventStartMs: earliestStartByRental.get(rental.id) ?? NaN,
      email,
      phone,
      contactName: contact?.full_name || null,
      fromFormImport: notes.includes(FORM_IMPORT_TAG),
    }
    remember(byEmail, email, row)
    remember(byPhone, phone, row)
    return row
  })

  // Count payments already on each rental (for deposit vs remaining_balance)
  const paidCountByRental = new Map()
  const { data: allPaid } = await sb
    .from("rental_payments")
    .select("venue_rental_id, status")
    .eq("organization_id", args.orgId)
    .in("status", ["paid_manually", "paid_stripe_later", "refunded"])

  for (const row of allPaid || []) {
    paidCountByRental.set(
      row.venue_rental_id,
      (paidCountByRental.get(row.venue_rental_id) || 0) + 1
    )
  }

  for (const payment of payments) {
    try {
      if (importedKeys.has(payment.importKey)) {
        report.skippedAlreadyImported += 1
        continue
      }

      const emailCandidates = payment.email
        ? byEmail.get(payment.email) || []
        : []
      const phoneCandidates = payment.phone
        ? byPhone.get(payment.phone) || []
        : []
      const merged = new Map()
      for (const c of [...emailCandidates, ...phoneCandidates]) {
        merged.set(c.id, c)
      }
      const rental = pickRental([...merged.values()], payment.paidAt.getTime())

      if (!rental) {
        report.skippedNoBooking += 1
        if (report.unmatchedSamples.length < 15) {
          report.unmatchedSamples.push({
            name: payment.customerName,
            email: payment.email,
            phone: payment.phone,
            amount: payment.amount,
            date: payment.paidAtIso.slice(0, 10),
          })
        }
        continue
      }

      report.matched += 1
      if (report.matchedSamples.length < 12) {
        report.matchedSamples.push({
          name: payment.customerName,
          email: payment.email,
          amount: payment.absAmount,
          date: payment.paidAtIso.slice(0, 10),
          rentalId: rental.id,
          rentalStatus: rental.status,
          isRefund: payment.isRefund,
        })
      }

      if (!args.execute) continue

      const priorPaid = paidCountByRental.get(rental.id) || 0
      const paymentType = payment.isRefund
        ? "refund"
        : priorPaid === 0
          ? "deposit"
          : "remaining_balance"
      const status = payment.isRefund ? "refunded" : "paid_manually"
      const notes = [
        `[${IMPORT_TAG}:${payment.importKey}]`,
        payment.customerName ? `Payer: ${payment.customerName}` : null,
        `CSV status: ${payment.csvStatus}`,
        `CSV amount: ${payment.amount}`,
      ]
        .filter(Boolean)
        .join("\n")

      const { error: insertError } = await sb.from("rental_payments").insert({
        organization_id: args.orgId,
        venue_rental_id: rental.id,
        payment_type: paymentType,
        status,
        amount: payment.absAmount,
        currency: "USD",
        paid_at: payment.paidAtIso,
        notes,
      })

      if (insertError) {
        throw new Error(insertError.message)
      }

      report.paymentsCreated += 1
      importedKeys.add(payment.importKey)
      paidCountByRental.set(rental.id, priorPaid + 1)

      // Light status bump for open payment states only
      if (
        !payment.isRefund &&
        ["submitted", "approved_pending_payment"].includes(rental.status)
      ) {
        const nextStatus =
          paymentType === "deposit" ? "deposit_paid" : "deposit_paid"
        const { error: statusError } = await sb
          .from("venue_rentals")
          .update({ status: nextStatus })
          .eq("id", rental.id)
          .eq("organization_id", args.orgId)
        if (!statusError) {
          rental.status = nextStatus
          report.rentalsStatusUpdated += 1
        }
      }
    } catch (error) {
      report.errors.push({
        name: payment.customerName,
        email: payment.email,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const outDir = resolve(root, "scripts/reports")
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(
    outDir,
    args.execute
      ? "venue-rental-payments-import-execute.json"
      : "venue-rental-payments-import-dry-run.json"
  )
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log(`\nWrote ${outPath}`)
  if (!args.execute) {
    console.log("Dry-run only. Re-run with --execute to write payments.")
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

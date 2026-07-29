/**
 * Delete imported Google Form venue rentals whose event starts BEFORE a cutoff
 * month (default: before July 2026, America/Chicago). Keeps that month and all
 * later months. Contacts are never deleted.
 *
 * Cascade removes rental_reservations (and synced resource_reservations),
 * rental_payments, rental_contracts, rental_selected_addons.
 * Operational briefs linked via source_type/source_id are removed when possible.
 *
 * Usage (dry-run by default):
 *   node scripts/cleanup-imported-venue-rentals-keep-month.mjs
 *   node scripts/cleanup-imported-venue-rentals-keep-month.mjs --execute
 *   node scripts/cleanup-imported-venue-rentals-keep-month.mjs --year 2026 --month 7 --execute
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL for --execute.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const IMPORT_TAG = "VENUE_RENTAL_GOOGLE_FORM_V1"
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const TIME_ZONE = "America/Chicago"

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
    execute: false,
    orgId: DEFAULT_ORG_ID,
    year: 2026,
    month: 7,
  }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--execute") args.execute = true
    else if (argv[i] === "--org-id") args.orgId = argv[++i]
    else if (argv[i] === "--year") args.year = Number(argv[++i])
    else if (argv[i] === "--month") args.month = Number(argv[++i])
  }
  if (!Number.isInteger(args.year) || args.year < 2000) {
    throw new Error("Invalid --year")
  }
  if (!Number.isInteger(args.month) || args.month < 1 || args.month > 12) {
    throw new Error("Invalid --month (1-12)")
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

function chicagoYearMonth(iso) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date(iso))
  const year = Number(parts.find((p) => p.type === "year")?.value)
  const month = Number(parts.find((p) => p.type === "month")?.value)
  return { year, month }
}

/** Keep July+ when cutoff is July 2026: on/after the first day of that month. */
function isOnOrAfterCutoffMonth(iso, year, month) {
  if (!iso) return false
  const ym = chicagoYearMonth(iso)
  if (ym.year > year) return true
  if (ym.year < year) return false
  return ym.month >= month
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

  const report = {
    importTag: IMPORT_TAG,
    mode: args.execute ? "execute" : "dry-run",
    orgId: args.orgId,
    keepFromYear: args.year,
    keepFromMonth: args.month,
    keepRule: `event start on/after ${args.year}-${String(args.month).padStart(2, "0")} (${TIME_ZONE})`,
    timeZone: TIME_ZONE,
    contactsDeleted: 0,
    importedRentalsFound: 0,
    keepCount: 0,
    deleteCount: 0,
    deletedRentals: 0,
    deletedBriefs: 0,
    deletedOverrideLogs: 0,
    deleteNoReservation: 0,
    errors: [],
    sampleKeep: [],
    sampleDelete: [],
  }

  const { data: importedRentals, error: rentalsError } = await sb
    .from("venue_rentals")
    .select("id, status, notes, billing_contact_id, created_at")
    .eq("organization_id", args.orgId)
    .ilike("notes", `%${IMPORT_TAG}%`)

  if (rentalsError) {
    throw new Error(rentalsError.message)
  }

  const rentals = importedRentals || []
  report.importedRentalsFound = rentals.length

  if (rentals.length === 0) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  const rentalIds = rentals.map((row) => row.id)
  const startByRental = new Map()

  for (const ids of chunk(rentalIds, 200)) {
    const { data: reservations, error: reservationError } = await sb
      .from("rental_reservations")
      .select("venue_rental_id, start_at")
      .eq("organization_id", args.orgId)
      .in("venue_rental_id", ids)

    if (reservationError) {
      throw new Error(reservationError.message)
    }

    for (const row of reservations || []) {
      const current = startByRental.get(row.venue_rental_id)
      if (!current || row.start_at < current) {
        startByRental.set(row.venue_rental_id, row.start_at)
      }
    }
  }

  const toKeep = []
  const toDelete = []

  for (const rental of rentals) {
    const startAt = startByRental.get(rental.id) || null
    const entry = {
      id: rental.id,
      status: rental.status,
      startAt,
      billingContactId: rental.billing_contact_id,
    }

    if (!startAt) {
      report.deleteNoReservation += 1
      toDelete.push(entry)
      continue
    }

    if (isOnOrAfterCutoffMonth(startAt, args.year, args.month)) {
      toKeep.push(entry)
    } else {
      toDelete.push(entry)
    }
  }

  report.keepCount = toKeep.length
  report.deleteCount = toDelete.length
  report.sampleKeep = toKeep.slice(0, 15)
  report.sampleDelete = toDelete.slice(0, 15)

  if (args.execute && toDelete.length > 0) {
    const deleteIds = toDelete.map((row) => row.id)

    for (const ids of chunk(deleteIds, 80)) {
      const { error: briefsError, count: briefsCount } = await sb
        .from("operational_briefs")
        .delete({ count: "exact" })
        .eq("organization_id", args.orgId)
        .eq("source_type", "venue_rental")
        .in("source_id", ids)

      if (briefsError) {
        report.errors.push(`operational_briefs: ${briefsError.message}`)
      } else {
        report.deletedBriefs += briefsCount || 0
      }

      const { error: logsError, count: logsCount } = await sb
        .from("reservation_override_logs")
        .delete({ count: "exact" })
        .eq("organization_id", args.orgId)
        .in("venue_rental_id", ids)

      if (logsError) {
        report.errors.push(`reservation_override_logs: ${logsError.message}`)
      } else {
        report.deletedOverrideLogs += logsCount || 0
      }

      const { error: deleteError, count: deletedCount } = await sb
        .from("venue_rentals")
        .delete({ count: "exact" })
        .eq("organization_id", args.orgId)
        .in("id", ids)

      if (deleteError) {
        report.errors.push(`venue_rentals: ${deleteError.message}`)
      } else {
        report.deletedRentals += deletedCount || 0
      }
    }
  }

  const reportsDir = resolve(root, "scripts/reports")
  mkdirSync(reportsDir, { recursive: true })
  const outPath = resolve(
    reportsDir,
    args.execute
      ? "cleanup-imported-venue-rentals-keep-from-month-execute.json"
      : "cleanup-imported-venue-rentals-keep-from-month-dry-run.json"
  )
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log(`\nWrote ${outPath}`)
  console.log(
    `\nContacts are never deleted. Kept ${report.keepCount} on/after ${args.year}-${String(args.month).padStart(2, "0")}; ${args.execute ? "deleted" : "would delete"} ${report.deleteCount} before cutoff.`
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

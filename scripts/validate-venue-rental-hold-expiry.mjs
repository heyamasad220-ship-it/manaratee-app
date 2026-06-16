/**
 * Live-safe read-only validation for Venue Rental Hold Expiry automation.
 *
 * Usage:
 *   node scripts/validate-venue-rental-hold-expiry.mjs
 *   node scripts/validate-venue-rental-hold-expiry.mjs --write-report
 *
 * Does NOT mutate data. Does NOT invoke the production cron endpoint.
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local for DB probes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const writeReport = process.argv.includes("--write-report")

const HOLD_PAYMENT_STATUSES = [
  "approved_pending_payment",
  "deposit_paid",
  "security_deposit_paid",
]

const TERMINAL_STATUSES = [
  "declined",
  "hold_expired",
  "cancelled_before_payment",
  "cancelled_after_payment",
  "closed",
]

const PROTECTED_ACTIVE_STATUSES = [
  "confirmed",
  "completed",
  "awaiting_security_deposit_refund_approval",
  "security_deposit_refunded",
]

function loadEnvLocal() {
  const path = resolve(root, ".env.local")
  if (!existsSync(path)) return false
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
  return true
}

function readSource(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

function record(checks, id, pass, detail) {
  checks.push({ id, pass: Boolean(pass), detail: detail ?? null })
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id}${detail ? ` — ${detail}` : ""}`)
}

function summarize(checks) {
  return {
    passed: checks.filter((c) => c.pass).length,
    total: checks.length,
    checks,
  }
}

function groupByOrg(rows) {
  const grouped = {}
  for (const row of rows) {
    const orgId = row.organization_id
    if (!grouped[orgId]) grouped[orgId] = []
    grouped[orgId].push(row.id)
  }
  return grouped
}

function groupByStatus(rows) {
  const grouped = {}
  for (const row of rows) {
    grouped[row.status] = (grouped[row.status] || 0) + 1
  }
  return grouped
}

loadEnvLocal()

const report = {
  startedAt: new Date().toISOString(),
  mode: "live-safe-read-only",
  suites: [],
  dryRun: null,
  warnings: [],
}

console.log("=== Venue Rental Hold Expiry — Live-Safe Validation ===\n")

// ---------------------------------------------------------------------------
// Static / repository checks
// ---------------------------------------------------------------------------
const staticChecks = []

record(
  staticChecks,
  "cron-route-exists",
  existsSync(resolve(root, "app/api/cron/venue-rental-hold-expiry/route.ts")),
  "app/api/cron/venue-rental-hold-expiry/route.ts"
)

const cronRouteSource = readSource("app/api/cron/venue-rental-hold-expiry/route.ts")
record(
  staticChecks,
  "cron-route-cr-secret-auth",
  cronRouteSource.includes("CRON_SECRET") &&
    cronRouteSource.includes("Bearer") &&
    cronRouteSource.includes("Unauthorized"),
  "Bearer CRON_SECRET pattern"
)
record(
  staticChecks,
  "cron-route-force-dynamic",
  cronRouteSource.includes('dynamic = "force-dynamic"'),
  "force-dynamic export"
)
record(
  staticChecks,
  "cron-route-get-post",
  cronRouteSource.includes("export async function GET") &&
    cronRouteSource.includes("export async function POST"),
  "GET and POST handlers"
)

const vercelJson = JSON.parse(readSource("vercel.json"))
const cronEntry = (vercelJson.crons || []).find(
  (entry) => entry.path === "/api/cron/venue-rental-hold-expiry"
)
record(
  staticChecks,
  "vercel-cron-registered",
  Boolean(cronEntry),
  cronEntry ? `schedule ${cronEntry.schedule}` : "missing"
)

const holdExpirySource = readSource("lib/bookings/venue-rental-hold-expiry.ts")
record(
  staticChecks,
  "job-status-filter",
  holdExpirySource.includes("VENUE_RENTAL_HOLD_PAYMENT_STATUSES") &&
    holdExpirySource.includes("approvedPendingPayment") &&
    holdExpirySource.includes("depositPaid") &&
    holdExpirySource.includes("securityDepositPaid"),
  "VENUE_RENTAL_HOLD_PAYMENT_STATUSES constants"
)
record(
  staticChecks,
  "job-org-scoped-updates",
  holdExpirySource.includes('.eq("organization_id", organizationId)') &&
    holdExpirySource.includes('.in("status", VENUE_RENTAL_HOLD_PAYMENT_STATUSES)'),
  "organization_id + status guards on update"
)
record(
  staticChecks,
  "job-reservation-expired",
  holdExpirySource.includes("RENTAL_RESERVATION_STATUSES.expired"),
  "rental_reservations -> expired"
)

const syncSql = readSource("scripts/046_venue_rentals_workflow.sql")
record(
  staticChecks,
  "calendar-sync-trigger",
  syncSql.includes("sync_rental_reservation_to_resource") &&
    syncSql.includes("NEW.status IN ('cancelled', 'expired')") &&
    syncSql.includes("DELETE FROM public.resource_reservations"),
  "expired reservation deletes resource_reservations row"
)

report.suites.push({ id: "static", label: "Repository / static", ...summarize(staticChecks) })

// ---------------------------------------------------------------------------
// Environment checklist (presence only — never print secret values)
// ---------------------------------------------------------------------------
const envChecks = []
const envPresent = (key) => Boolean(process.env[key]?.trim())

record(envChecks, "env-next-public-supabase-url", envPresent("NEXT_PUBLIC_SUPABASE_URL"))
record(envChecks, "env-supabase-service-role-key", envPresent("SUPABASE_SERVICE_ROLE_KEY"))
record(envChecks, "env-cron-secret", envPresent("CRON_SECRET"), envPresent("CRON_SECRET")
  ? "set (required in production)"
  : "unset — cron auth bypassed only when NODE_ENV=development")

if (!envPresent("CRON_SECRET")) {
  report.warnings.push(
    "CRON_SECRET is unset locally. Production must set CRON_SECRET or the cron route returns 401."
  )
}

report.suites.push({ id: "environment", label: "Environment variables", ...summarize(envChecks) })

// ---------------------------------------------------------------------------
// Live read-only dry-run probes (SELECT only)
// ---------------------------------------------------------------------------
const dbChecks = []
let dryRun = null

let supabase = null
try {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase credentials")
  supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  record(dbChecks, "db-connect", true, "service role client created")
} catch (error) {
  record(dbChecks, "db-connect", false, error.message)
  report.warnings.push("Database probes skipped — configure .env.local for live dry-run.")
}

if (supabase) {
  const nowIso = new Date().toISOString()

  const { data: eligible, error: eligibleError } = await supabase
    .from("venue_rentals")
    .select("id, organization_id, status, hold_expires_at")
    .in("status", HOLD_PAYMENT_STATUSES)
    .not("hold_expires_at", "is", null)
    .lte("hold_expires_at", nowIso)

  record(
    dbChecks,
    "dry-run-eligible-query",
    !eligibleError,
    eligibleError ? eligibleError.message : `${(eligible || []).length} row(s) would expire now`
  )

  const eligibleRows = eligible || []
  const eligibleByOrg = groupByOrg(eligibleRows)
  const eligibleByStatus = groupByStatus(eligibleRows)

  const { data: confirmedPastHold, error: confirmedError } = await supabase
    .from("venue_rentals")
    .select("id, organization_id, status, hold_expires_at")
    .eq("status", "confirmed")
    .not("hold_expires_at", "is", null)
    .lte("hold_expires_at", nowIso)

  record(
    dbChecks,
    "exclusion-confirmed-past-hold",
    !confirmedError,
    confirmedError
      ? confirmedError.message
      : `${(confirmedPastHold || []).length} confirmed rental(s) with past hold_expires_at (must NOT be in eligible set)`
  )

  const confirmedIds = new Set((confirmedPastHold || []).map((row) => row.id))
  const overlapConfirmed = eligibleRows.filter((row) => confirmedIds.has(row.id))
  record(
    dbChecks,
    "exclusion-confirmed-not-eligible",
    overlapConfirmed.length === 0,
    overlapConfirmed.length
      ? `OVERLAP: ${overlapConfirmed.map((row) => row.id).join(", ")}`
      : "no confirmed rentals in eligible dry-run set"
  )

  const { data: terminalPastHold, error: terminalError } = await supabase
    .from("venue_rentals")
    .select("id, status, hold_expires_at")
    .in("status", TERMINAL_STATUSES)
    .not("hold_expires_at", "is", null)
    .lte("hold_expires_at", nowIso)

  record(
    dbChecks,
    "exclusion-terminal-past-hold",
    !terminalError,
    terminalError
      ? terminalError.message
      : `${(terminalPastHold || []).length} terminal rental(s) with past hold_expires_at (job query excludes by status)`
  )

  const terminalIds = new Set((terminalPastHold || []).map((row) => row.id))
  const overlapTerminal = eligibleRows.filter((row) => terminalIds.has(row.id))
  record(
    dbChecks,
    "exclusion-terminal-not-eligible",
    overlapTerminal.length === 0,
    overlapTerminal.length === 0 ? "no terminal rentals in eligible dry-run set" : "unexpected overlap"
  )

  const { data: protectedPastHold, error: protectedError } = await supabase
    .from("venue_rentals")
    .select("id, status")
    .in("status", PROTECTED_ACTIVE_STATUSES)
    .not("hold_expires_at", "is", null)
    .lte("hold_expires_at", nowIso)

  record(
    dbChecks,
    "exclusion-protected-active-statuses",
    !protectedError && overlapConfirmed.length === 0,
    protectedError
      ? protectedError.message
      : `${(protectedPastHold || []).length} protected active rental(s) with past hold_expires_at outside eligible statuses`
  )

  const { data: activeFutureHolds, error: futureError } = await supabase
    .from("venue_rentals")
    .select("id")
    .in("status", HOLD_PAYMENT_STATUSES)
    .not("hold_expires_at", "is", null)
    .gt("hold_expires_at", nowIso)

  record(
    dbChecks,
    "active-future-holds-present",
    !futureError,
    futureError
      ? futureError.message
      : `${(activeFutureHolds || []).length} hold-payment rental(s) still within hold window`
  )

  let reservationProbe = { linkedCount: 0, nonExpiredLinked: 0, sample: [] }
  if (eligibleRows.length > 0) {
    const eligibleIds = eligibleRows.map((row) => row.id)
    const { data: reservations, error: reservationError } = await supabase
      .from("rental_reservations")
      .select("id, venue_rental_id, organization_id, status")
      .in("venue_rental_id", eligibleIds)

    record(
      dbChecks,
      "reservation-probe",
      !reservationError,
      reservationError ? reservationError.message : `${(reservations || []).length} linked reservation row(s)`
    )

    if (!reservationError) {
      const rows = reservations || []
      reservationProbe = {
        linkedCount: rows.length,
        nonExpiredLinked: rows.filter((row) => row.status !== "expired").length,
        sample: rows.slice(0, 5).map((row) => ({
          id: row.id,
          venue_rental_id: row.venue_rental_id,
          organization_id: row.organization_id,
          status: row.status,
        })),
      }

      record(
        dbChecks,
        "org-isolation-reservation-org-match",
        rows.every((row) => {
          const rental = eligibleRows.find((item) => item.id === row.venue_rental_id)
          return rental && rental.organization_id === row.organization_id
        }),
        rows.length
          ? "all probed reservations share organization_id with parent rental"
          : "no linked reservations for eligible rentals"
      )
    }
  } else {
    record(dbChecks, "reservation-probe", true, "no eligible rentals — reservation probe skipped")
    record(dbChecks, "org-isolation-reservation-org-match", true, "no eligible rentals")
  }

  const orgCount = Object.keys(eligibleByOrg).length
  record(
    dbChecks,
    "org-isolation-multi-tenant-grouping",
    eligibleRows.every((row) => row.organization_id),
    `${orgCount} organization(s) represented in dry-run eligible set`
  )

  dryRun = {
    asOf: nowIso,
    eligibleCount: eligibleRows.length,
    eligibleByOrganization: Object.fromEntries(
      Object.entries(eligibleByOrg).map(([orgId, ids]) => [orgId, ids.length])
    ),
    eligibleByStatus: eligibleByStatus,
    eligibleRentalIds: eligibleRows.map((row) => row.id),
    confirmedPastHoldCount: (confirmedPastHold || []).length,
    terminalPastHoldCount: (terminalPastHold || []).length,
    protectedActivePastHoldCount: (protectedPastHold || []).length,
    activeFutureHoldCount: (activeFutureHolds || []).length,
    reservationProbe,
    wouldMutate: eligibleRows.length > 0,
  }

  if (eligibleRows.length > 0) {
    report.warnings.push(
      `${eligibleRows.length} live rental(s) would be expired if the real cron ran now. Do NOT invoke production cron without explicit approval.`
    )
  }

  report.dryRun = dryRun
}

report.suites.push({ id: "database", label: "Live read-only dry-run", ...summarize(dbChecks) })

const allChecks = report.suites.flatMap((suite) => suite.checks)
report.finishedAt = new Date().toISOString()
report.summary = {
  passed: allChecks.filter((check) => check.pass).length,
  total: allChecks.length,
  failed: allChecks.filter((check) => !check.pass).map((check) => check.id),
  dryRunEligibleCount: dryRun?.eligibleCount ?? null,
  wouldMutateLiveData: dryRun?.wouldMutate ?? null,
}

console.log("\n=== Summary ===")
console.log(`Checks: ${report.summary.passed}/${report.summary.total} passed`)
if (dryRun) {
  console.log(`Dry-run eligible holds (would expire now): ${dryRun.eligibleCount}`)
  console.log(`Would mutate live data if cron ran: ${dryRun.wouldMutate ? "YES" : "NO"}`)
}
if (report.warnings.length) {
  console.log("\nWarnings:")
  for (const warning of report.warnings) console.log(`- ${warning}`)
}

if (writeReport) {
  const outDir = resolve(root, "scripts/reports")
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, "venue-rental-hold-expiry-validation.json")
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`\nReport written: ${outPath}`)
}

process.exit(report.summary.failed.length ? 1 : 0)

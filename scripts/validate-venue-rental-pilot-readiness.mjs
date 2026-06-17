/**
 * Venue Rentals Phase 1 — Pilot Readiness Validation (read-only).
 *
 * Usage:
 *   node scripts/validate-venue-rental-pilot-readiness.mjs
 *   node scripts/validate-venue-rental-pilot-readiness.mjs --write-report
 *
 * Does NOT mutate data. Does NOT invoke production cron.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const writeReport = process.argv.includes("--write-report")

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

function sourceExists(relativePath) {
  return existsSync(resolve(root, relativePath))
}

function record(checks, id, pass, detail, severity = "blocker") {
  checks.push({ id, pass: Boolean(pass), detail: detail ?? null, severity })
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id}${detail ? ` — ${detail}` : ""}`)
}

function summarize(checks) {
  return {
    passed: checks.filter((c) => c.pass).length,
    total: checks.length,
    failed: checks.filter((c) => !c.pass).map((c) => c.id),
    blockers: checks.filter((c) => !c.pass && c.severity === "blocker").map((c) => c.id),
  }
}

loadEnvLocal()

const report = {
  startedAt: new Date().toISOString(),
  mode: "pilot-readiness-read-only",
  suites: [],
  dryRun: null,
  testRun: null,
  readinessScore: null,
  recommendation: null,
}

console.log("=== Venue Rentals Phase 1 — Pilot Readiness Validation ===\n")

// ---------------------------------------------------------------------------
// 1. Static deliverable checks
// ---------------------------------------------------------------------------
const deliverableChecks = []

const customerGuidance = readSource("lib/bookings/customer-rental-process-guidance.ts")
record(
  deliverableChecks,
  "d3-customer-guidance-module",
  customerGuidance.includes("staff will email") || customerGuidance.includes("Staff will email"),
  "customer-rental-process-guidance.ts"
)
record(
  deliverableChecks,
  "d3-no-disabled-pay-buttons",
  !readSource("components/customer/rentals/customer-rental-payments-section.tsx").includes("disabled") ||
    readSource("components/customer/rentals/customer-rental-payments-section.tsx").includes(
      "CustomerRentalProcessGuidanceCallout"
    ),
  "payments section uses guidance callout"
)

const paymentsSection = readSource("components/customer/rentals/customer-rental-payments-section.tsx")
record(
  deliverableChecks,
  "d3-guidance-callout-present",
  paymentsSection.includes("CustomerRentalProcessGuidanceCallout"),
  "staff-mediated payment copy"
)

const detailClient = readSource("components/bookings/venue-rental-detail-client.tsx")
record(
  deliverableChecks,
  "d1-cancel-ui",
  detailClient.includes("cancelVenueRental") && detailClient.includes("Cancel rental"),
  "staff cancel card"
)
record(
  deliverableChecks,
  "d4-force-book-ui",
  detailClient.includes("forceBookVenueRentalWithOverride") &&
    detailClient.includes("Force-book override"),
  "force-book card + dialog"
)

record(
  deliverableChecks,
  "d2-hold-expiry-job",
  sourceExists("lib/bookings/venue-rental-hold-expiry.ts"),
  "hold expiry job module"
)
record(
  deliverableChecks,
  "d2-cron-route",
  sourceExists("app/api/cron/venue-rental-hold-expiry/route.ts"),
  "cron route"
)

const cronRoute = readSource("app/api/cron/venue-rental-hold-expiry/route.ts")
record(
  deliverableChecks,
  "d2-cron-secret-auth",
  cronRoute.includes("CRON_SECRET") && cronRoute.includes("Unauthorized"),
  "Bearer CRON_SECRET"
)

const vercelJson = JSON.parse(readSource("vercel.json"))
record(
  deliverableChecks,
  "d2-vercel-cron",
  (vercelJson.crons || []).some((c) => c.path === "/api/cron/venue-rental-hold-expiry"),
  "hourly schedule registered"
)

report.suites.push({
  id: "deliverables",
  label: "Phase 1 deliverables (static)",
  ...summarize(deliverableChecks),
  checks: deliverableChecks,
})

// ---------------------------------------------------------------------------
// 2. Core workflow + audit (static)
// ---------------------------------------------------------------------------
const workflowChecks = []
const actions = readSource("lib/bookings/venue-rental-actions.ts")

for (const fn of [
  "submitVenueRentalRequest",
  "approveVenueRentalRequest",
  "markRentalPaymentPaid",
  "syncVenueRentalStatusAfterPayment",
  "cancelVenueRental",
  "forceBookVenueRentalWithOverride",
  "expireVenueRentalHolds",
]) {
  record(workflowChecks, `workflow-action-${fn}`, actions.includes(`export async function ${fn}`), fn)
}

record(
  workflowChecks,
  "audit-cancel-log",
  actions.includes('action: "cancel_rental"') && actions.includes("reservation_override_logs"),
  "cancel writes override log"
)
record(
  workflowChecks,
  "audit-force-book-log",
  actions.includes('action: "force_book"') && actions.includes("previous_status"),
  "force-book writes metadata"
)

const syncSql = readSource("scripts/046_venue_rentals_workflow.sql")
record(
  workflowChecks,
  "calendar-sync-trigger",
  syncSql.includes("sync_rental_reservation_to_resource") &&
    syncSql.includes("NEW.status IN ('cancelled', 'expired')"),
  "cancelled/expired releases calendar"
)

record(
  workflowChecks,
  "legacy-containment-comment",
  actions.includes("Do NOT insert into legacy `venue_bookings`"),
  "venue-rental-actions guards legacy path"
)

const customerNewPage = readSource("app/(customer)/customer/rentals/new/page.tsx")
record(
  workflowChecks,
  "customer-submit-route",
  customerNewPage.includes("submitVenueRentalRequest") || customerNewPage.includes("venue-rental"),
  "customer new rental route"
)

report.suites.push({
  id: "workflow",
  label: "Core workflow + calendar + legacy (static)",
  ...summarize(workflowChecks),
  checks: workflowChecks,
})

// ---------------------------------------------------------------------------
// 3. Environment
// ---------------------------------------------------------------------------
const envChecks = []
const env = (key) => Boolean(process.env[key]?.trim())

record(envChecks, "env-supabase-url", env("NEXT_PUBLIC_SUPABASE_URL"))
record(envChecks, "env-service-role", env("SUPABASE_SERVICE_ROLE_KEY"))
record(
  envChecks,
  "env-cron-secret",
  env("CRON_SECRET"),
  env("CRON_SECRET") ? "set locally" : "unset — required in production",
  env("CRON_SECRET") ? "info" : "blocker"
)

report.suites.push({
  id: "environment",
  label: "Environment variables",
  ...summarize(envChecks),
  checks: envChecks,
})

// ---------------------------------------------------------------------------
// 4. Unit tests
// ---------------------------------------------------------------------------
const testChecks = []
const testRun = spawnSync("npm", ["run", "test:conflicts"], {
  cwd: root,
  shell: true,
  encoding: "utf8",
})

record(
  testChecks,
  "unit-tests-conflicts",
  testRun.status === 0,
  testRun.status === 0 ? "npm run test:conflicts passed" : `exit ${testRun.status}`
)

report.testRun = {
  exitCode: testRun.status,
  stdoutTail: (testRun.stdout || "").split("\n").slice(-8).join("\n"),
}

report.suites.push({
  id: "tests",
  label: "Regression tests",
  ...summarize(testChecks),
  checks: testChecks,
})

// ---------------------------------------------------------------------------
// 5. Live read-only DB probes
// ---------------------------------------------------------------------------
const dbChecks = []
let dryRun = null

let supabase = null
try {
  if (!env("NEXT_PUBLIC_SUPABASE_URL") || !env("SUPABASE_SERVICE_ROLE_KEY")) {
    throw new Error("Missing Supabase credentials")
  }
  supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  record(dbChecks, "db-connect", true, "service role")
} catch (error) {
  record(dbChecks, "db-connect", false, error.message)
}

if (supabase) {
  const nowIso = new Date().toISOString()

  const { data: eligible, error: eligibleError } = await supabase
    .from("venue_rentals")
    .select("id, status")
    .in("status", ["approved_pending_payment", "deposit_paid", "security_deposit_paid"])
    .not("hold_expires_at", "is", null)
    .lte("hold_expires_at", nowIso)

  record(
    dbChecks,
    "hold-expiry-dry-run-zero",
    !eligibleError && (eligible || []).length === 0,
    eligibleError ? eligibleError.message : `${(eligible || []).length} eligible hold(s)`
  )

  dryRun = { eligibleCount: (eligible || []).length, asOf: nowIso }

  const { count: overrideCancelCount } = await supabase
    .from("reservation_override_logs")
    .select("id", { count: "exact", head: true })
    .eq("action", "cancel_rental")

  const { count: overrideForceCount } = await supabase
    .from("reservation_override_logs")
    .select("id", { count: "exact", head: true })
    .eq("action", "force_book")

  record(
    dbChecks,
    "audit-log-table-readable",
    overrideCancelCount !== null && overrideForceCount !== null,
    `cancel_rental logs: ${overrideCancelCount ?? "?"}, force_book logs: ${overrideForceCount ?? "?"}`
  )

  const { count: activeRentals } = await supabase
    .from("venue_rentals")
    .select("id", { count: "exact", head: true })
    .in("status", [
      "awaiting_supervisor_approval",
      "approved_pending_payment",
      "deposit_paid",
      "security_deposit_paid",
      "confirmed",
    ])

  record(
    dbChecks,
    "live-rentals-readable",
    activeRentals !== null,
    `${activeRentals ?? "?"} active pipeline rental(s)`,
    "info"
  )

  const { count: legacyBookingsRecent } = await supabase
    .from("venue_bookings")
    .select("id", { count: "exact", head: true })

  record(
    dbChecks,
    "legacy-venue-bookings-table",
    legacyBookingsRecent !== null,
    `${legacyBookingsRecent ?? "?"} legacy venue_bookings row(s) — new flow uses venue_rentals`,
    "info"
  )
}

report.dryRun = dryRun
report.suites.push({
  id: "database",
  label: "Live read-only probes",
  ...summarize(dbChecks),
  checks: dbChecks,
})

// ---------------------------------------------------------------------------
// Score + recommendation
// ---------------------------------------------------------------------------
const allChecks = report.suites.flatMap((s) => s.checks)
const blockers = allChecks.filter((c) => !c.pass && c.severity === "blocker")
const passed = allChecks.filter((c) => c.pass).length
const total = allChecks.length
const score = Math.round((passed / total) * 100)

report.readinessScore = score
report.recommendation =
  blockers.length === 0 && testRun.status === 0 && (dryRun?.eligibleCount ?? 0) === 0
    ? "CONDITIONAL_GO"
    : blockers.length <= 1 && blockers.every((b) => b.id === "env-cron-secret")
      ? "CONDITIONAL_GO"
      : "NO_GO"

report.finishedAt = new Date().toISOString()
report.summary = {
  passed,
  total,
  blockers: blockers.map((b) => b.id),
  readinessScore: score,
  recommendation: report.recommendation,
}

console.log("\n=== Summary ===")
console.log(`Checks: ${passed}/${total}`)
console.log(`Readiness score: ${score}/100`)
console.log(`Recommendation: ${report.recommendation}`)
if (blockers.length) {
  console.log(`Blockers: ${blockers.map((b) => b.id).join(", ")}`)
}

if (writeReport) {
  const outDir = resolve(root, "scripts/reports")
  mkdirSync(outDir, { recursive: true })
  writeFileSync(
    resolve(outDir, "venue-rental-pilot-readiness.json"),
    JSON.stringify(report, null, 2)
  )
  console.log("\nReport: scripts/reports/venue-rental-pilot-readiness.json")
}

process.exit(blockers.length && report.recommendation === "NO_GO" ? 1 : 0)

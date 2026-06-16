/**
 * Post-cancellation validation for experimental venue rental hold cleanup.
 * Read-only except writing report JSON.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const RENTAL_ID = "49ce1da2-fd1e-4f4c-9cfc-62c33e07eb9d"
const ORGANIZATION_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const RESERVATION_ID = "ac1e0a98-4f8e-49ba-8de2-1f6544d8bcd4"
const EXPECTED_REASON = "Experimental hold cleanup before enabling hold expiry automation."

const HOLD_PAYMENT_STATUSES = [
  "approved_pending_payment",
  "deposit_paid",
  "security_deposit_paid",
]

function loadEnvLocal() {
  const path = resolve(root, ".env.local")
  if (!existsSync(path)) throw new Error(".env.local not found")
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

loadEnvLocal()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const nowIso = new Date().toISOString()
const checks = []

function record(id, pass, detail) {
  checks.push({ id, pass, detail })
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id}${detail ? ` — ${detail}` : ""}`)
}

const { data: rental } = await supabase
  .from("venue_rentals")
  .select("id, status, notes, hold_expires_at, organization_id")
  .eq("id", RENTAL_ID)
  .maybeSingle()

record(
  "rental-cancelled-status",
  rental?.status === "cancelled_before_payment" || rental?.status === "cancelled_after_payment",
  rental ? `status=${rental.status}` : "missing"
)

record(
  "rental-before-payment-appropriate",
  rental?.status === "cancelled_before_payment",
  "approved_pending_payment with no paid deposits -> cancelled_before_payment"
)

record(
  "rental-hold-cleared",
  rental?.hold_expires_at === null,
  rental?.hold_expires_at ? `still set: ${rental.hold_expires_at}` : "hold_expires_at null"
)

const notes = rental?.notes || ""
record(
  "notes-appended-not-overwritten",
  notes.includes(EXPECTED_REASON) && notes.includes("[Cancelled "),
  notes ? `notes length ${notes.length}` : "empty notes"
)

const { data: reservations } = await supabase
  .from("rental_reservations")
  .select("id, status, hold_expires_at, organization_id, venue_rental_id")
  .eq("venue_rental_id", RENTAL_ID)

const reservationRows = reservations || []
record(
  "reservations-cancelled",
  reservationRows.length > 0 && reservationRows.every((row) => row.status === "cancelled"),
  reservationRows.map((row) => `${row.id}:${row.status}`).join(", ") || "none"
)

const reservationIds = reservationRows.map((row) => row.id)
const { data: resourceRows } = await supabase
  .from("resource_reservations")
  .select("id, source_type, source_id, status")
  .eq("source_type", "venue_rental")
  .in("source_id", reservationIds.length ? reservationIds : ["00000000-0000-0000-0000-000000000000"])

record(
  "calendar-blocks-released",
  (resourceRows || []).length === 0,
  (resourceRows || []).length
    ? `${resourceRows.length} resource_reservation row(s) still present`
    : "no resource_reservations for rental reservation source ids"
)

const { data: overrideLogs } = await supabase
  .from("reservation_override_logs")
  .select("id, action, reason, metadata, created_at, staff_user_id")
  .eq("venue_rental_id", RENTAL_ID)
  .eq("action", "cancel_rental")
  .order("created_at", { ascending: false })
  .limit(5)

const cancelLog = (overrideLogs || []).find((row) => row.reason === EXPECTED_REASON)
record(
  "audit-log-cancel-entry",
  Boolean(cancelLog),
  cancelLog
    ? `log ${cancelLog.id} at ${cancelLog.created_at}`
    : `found ${(overrideLogs || []).length} cancel_rental log(s), none with exact reason`
)

if (cancelLog) {
  record(
    "audit-log-metadata",
    cancelLog.metadata?.previous_status === "approved_pending_payment" &&
      (cancelLog.metadata?.next_status === "cancelled_before_payment" ||
        cancelLog.metadata?.next_status === "cancelled_after_payment"),
    JSON.stringify(cancelLog.metadata)
  )
}

const { data: eligible } = await supabase
  .from("venue_rentals")
  .select("id")
  .in("status", HOLD_PAYMENT_STATUSES)
  .not("hold_expires_at", "is", null)
  .lte("hold_expires_at", nowIso)

record(
  "hold-expiry-dry-run-eligible-count",
  (eligible || []).length === 0,
  `${(eligible || []).length} eligible hold(s) remaining`
)

const report = {
  validatedAt: nowIso,
  rentalId: RENTAL_ID,
  organizationId: ORGANIZATION_ID,
  rental,
  reservations: reservationRows,
  resourceReservationsRemaining: resourceRows || [],
  cancelLogs: overrideLogs || [],
  dryRunEligibleCount: (eligible || []).length,
  checks,
  summary: {
    passed: checks.filter((c) => c.pass).length,
    total: checks.length,
    allPassed: checks.every((c) => c.pass),
  },
}

const outDir = resolve(root, "scripts/reports")
mkdirSync(outDir, { recursive: true })
writeFileSync(
  resolve(outDir, "experimental-hold-cleanup-validation.json"),
  JSON.stringify(report, null, 2)
)

console.log("\n=== Summary ===")
console.log(`${report.summary.passed}/${report.summary.total} checks passed`)
console.log(`Dry-run eligibleCount: ${report.dryRunEligibleCount}`)
console.log(`Report: scripts/reports/experimental-hold-cleanup-validation.json`)

process.exit(report.summary.allPassed ? 0 : 1)

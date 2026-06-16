/**
 * Cancel the experimental venue rental hold identified by hold-expiry dry-run.
 * Mirrors lib/bookings/venue-rental-actions.ts cancelVenueRental workflow.
 *
 * Usage:
 *   node scripts/cancel-experimental-venue-rental-hold.mjs
 *   node scripts/cancel-experimental-venue-rental-hold.mjs --dry-run
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const dryRun = process.argv.includes("--dry-run")

const RENTAL_ID = "49ce1da2-fd1e-4f4c-9cfc-62c33e07eb9d"
const ORGANIZATION_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const REASON = "Experimental hold cleanup before enabling hold expiry automation."

const CANCELLABLE = new Set([
  "awaiting_supervisor_approval",
  "approved_pending_payment",
  "deposit_paid",
  "security_deposit_paid",
  "confirmed",
])

const PAID_STATUSES = new Set(["paid_manually", "paid_stripe_later"])

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

function shouldCancelAfterPayment(status, depositPaid, securityDepositPaid) {
  if (status === "confirmed") return true
  if (status === "deposit_paid" || status === "security_deposit_paid") return true
  return Boolean(depositPaid || securityDepositPaid)
}

loadEnvLocal()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

console.log(`=== Cancel experimental venue rental hold ${dryRun ? "(DRY RUN)" : ""} ===\n`)

const { data: rental, error: rentalError } = await supabase
  .from("venue_rentals")
  .select("id, status, notes, hold_expires_at, organization_id")
  .eq("id", RENTAL_ID)
  .eq("organization_id", ORGANIZATION_ID)
  .maybeSingle()

if (rentalError || !rental) {
  console.error("Rental not found:", rentalError?.message || "missing")
  process.exit(1)
}

console.log("Rental before:", {
  id: rental.id,
  status: rental.status,
  hold_expires_at: rental.hold_expires_at,
  notes_length: (rental.notes || "").length,
})

if (!CANCELLABLE.has(rental.status)) {
  console.error(`Cannot cancel — status is ${rental.status}`)
  process.exit(1)
}

const { data: paymentRows } = await supabase
  .from("rental_payments")
  .select("payment_type, status")
  .eq("venue_rental_id", RENTAL_ID)
  .eq("organization_id", ORGANIZATION_ID)

const depositPaid = (paymentRows || []).some(
  (p) => p.payment_type === "deposit" && PAID_STATUSES.has(p.status)
)
const securityDepositPaid = (paymentRows || []).some(
  (p) => p.payment_type === "security_deposit" && PAID_STATUSES.has(p.status)
)
const afterPayment = shouldCancelAfterPayment(rental.status, depositPaid, securityDepositPaid)
const nextStatus = afterPayment ? "cancelled_after_payment" : "cancelled_before_payment"
const cancellationNote = `[Cancelled ${new Date().toISOString()}] ${REASON}`
const nextNotes = [rental.notes, cancellationNote].filter(Boolean).join("\n\n")

console.log("Cancel plan:", {
  previous_status: rental.status,
  next_status: nextStatus,
  after_payment: afterPayment,
  reason: REASON,
})

if (dryRun) {
  console.log("\nDry run only — no changes applied.")
  process.exit(0)
}

const { data: staffProfile } = await supabase
  .from("profiles")
  .select("id, user_id, full_name")
  .eq("active_organization_id", ORGANIZATION_ID)
  .limit(1)
  .maybeSingle()

const staffUserId = staffProfile?.user_id
if (!staffUserId) {
  console.error("No staff profile found for audit log staff_user_id")
  process.exit(1)
}

const { error: updateError } = await supabase
  .from("venue_rentals")
  .update({
    status: nextStatus,
    hold_expires_at: null,
    notes: nextNotes,
  })
  .eq("id", RENTAL_ID)
  .eq("organization_id", ORGANIZATION_ID)

if (updateError) {
  console.error("Failed to cancel rental:", updateError.message)
  process.exit(1)
}

const { error: reservationError } = await supabase
  .from("rental_reservations")
  .update({ status: "cancelled", hold_expires_at: null })
  .eq("venue_rental_id", RENTAL_ID)
  .eq("organization_id", ORGANIZATION_ID)

if (reservationError) {
  console.error("Failed to cancel reservations:", reservationError.message)
  process.exit(1)
}

const { error: logError } = await supabase.from("reservation_override_logs").insert({
  organization_id: ORGANIZATION_ID,
  venue_rental_id: RENTAL_ID,
  rental_reservation_id: null,
  resource_reservation_id: null,
  action: "cancel_rental",
  reason: REASON,
  staff_user_id: staffUserId,
  metadata: {
    after_payment: afterPayment,
    previous_status: rental.status,
    next_status: nextStatus,
    cleanup_script: "cancel-experimental-venue-rental-hold.mjs",
  },
})

if (logError) {
  console.error("Failed to write audit log:", logError.message)
  process.exit(1)
}

console.log("\nCancellation applied successfully.")
console.log(JSON.stringify({ rentalId: RENTAL_ID, nextStatus, staffUserId }, null, 2))

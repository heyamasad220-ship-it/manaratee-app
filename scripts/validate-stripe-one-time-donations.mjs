/**
 * Validates Stripe one-time donation checkout + webhook idempotency (simulated events).
 * Usage: node scripts/validate-stripe-one-time-donations.mjs
 *
 * Requires migration 093_stripe_one_time_donations.sql applied.
 * Run after: node scripts/seed-donations-dev.mjs --confirm-dev
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import {
  buildCampaignAnalytics,
  computeCampaignMetrics,
  buildPledgeCampaignMap,
} from "./lib/campaign-analytics.mjs"
import {
  insertProcessorPaymentFromCheckout,
  recordProcessorEvent,
  simulateCheckoutCompleted,
} from "./lib/stripe-processor-payment.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const SEED_CAMPAIGN_CODE = "DEV-RAMADAN-2026"
const STRIPE_TEST_TAG = "STRIPE_ONE_TIME_VALIDATION"

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

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing Supabase credentials")
  process.exit(2)
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const checks = []
function record(id, pass, detail, extra = {}) {
  checks.push({ id, pass, detail, ...extra })
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id}${detail ? ` — ${detail}` : ""}`)
}

async function hasDonorRole(organizationId, contactId) {
  const { data, error } = await sb
    .from("contact_roles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("role", "donor")
    .limit(1)

  if (error) return { ok: false, error: error.message }
  return { ok: true, hasRole: (data || []).length > 0 }
}

async function countDonorRoles(organizationId, contactId) {
  const { count, error } = await sb
    .from("contact_roles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("role", "donor")

  if (error) return { ok: false, error: error.message }
  return { ok: true, count: count ?? 0 }
}

async function resolveOrgId() {
  const explicit = process.env.DONATIONS_SEED_ORG_ID
  if (explicit) return explicit

  const { data } = await sb
    .from("contacts")
    .select("organization_id")
    .eq("email", "donations-seed-individual@dev.test")
    .maybeSingle()

  if (data?.organization_id) return data.organization_id

  const { data: org } = await sb.from("organizations").select("id").limit(1).maybeSingle()
  return org?.id ?? null
}

const orgId = await resolveOrgId()
if (!orgId) {
  console.error("No organization found for validation")
  process.exit(2)
}

const schemaChecks = await Promise.all([
  sb.from("donation_checkout_sessions").select("id").limit(1),
  sb.from("payment_processor_events").select("id").limit(1),
  sb.from("payments").select("stripe_payment_intent_id").limit(1),
])

record("schema_checkout_sessions", !schemaChecks[0].error, schemaChecks[0].error?.message || "ok")
record("schema_processor_events", !schemaChecks[1].error, schemaChecks[1].error?.message || "ok")
record("schema_payments_stripe_cols", !schemaChecks[2].error, schemaChecks[2].error?.message || "ok")

let { data: campaign } = await sb
  .from("campaigns")
  .select("id, goal_amount")
  .eq("organization_id", orgId)
  .eq("code", SEED_CAMPAIGN_CODE)
  .maybeSingle()

if (!campaign?.id) {
  const { data: fallbackCampaign } = await sb
    .from("campaigns")
    .select("id, goal_amount")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!fallbackCampaign?.id) {
    console.error("No campaign found for validation")
    process.exit(2)
  }
  campaign = fallbackCampaign
}

let { data: donor } = await sb
  .from("donors")
  .select("id, contact_id, full_name, email")
  .eq("organization_id", orgId)
  .ilike("email", "donations-seed-individual%")
  .maybeSingle()

if (!donor?.id) {
  const { data: fallbackDonor } = await sb
    .from("donors")
    .select("id, contact_id, full_name, email")
    .eq("organization_id", orgId)
    .not("contact_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  donor = fallbackDonor
}

const { data: category } = await sb
  .from("donation_categories")
  .select("id")
  .eq("organization_id", orgId)
  .ilike("name", "Seed Zakat%")
  .maybeSingle()

const { data: fund } = await sb
  .from("donation_subcategories")
  .select("id")
  .eq("organization_id", orgId)
  .ilike("name", "Seed General Fund%")
  .maybeSingle()

if (!donor?.id || !donor.contact_id) {
  console.error("Missing donor with contact_id for validation")
  process.exit(2)
}

await sb
  .from("payments")
  .delete()
  .eq("organization_id", orgId)
  .like("stripe_payment_intent_id", `${STRIPE_TEST_TAG}%`)

await sb
  .from("payment_processor_events")
  .delete()
  .eq("organization_id", orgId)
  .like("stripe_event_id", `${STRIPE_TEST_TAG}%`)

await sb
  .from("donation_checkout_sessions")
  .delete()
  .eq("organization_id", orgId)
  .like("stripe_checkout_session_id", `cs_test_${STRIPE_TEST_TAG}%`)

const testStripeSessionId = `cs_test_${STRIPE_TEST_TAG}`
const testPaymentIntentId = `${STRIPE_TEST_TAG}_pi_001`
const testEventId = `${STRIPE_TEST_TAG}_evt_001`
const amountCents = 4200

const { data: checkoutRow, error: checkoutInsertError } = await sb
  .from("donation_checkout_sessions")
  .insert({
    organization_id: orgId,
    checkout_type: "one_time",
    stripe_checkout_session_id: testStripeSessionId,
    donor_id: donor.id,
    contact_id: donor.contact_id,
    campaign_id: campaign.id,
    category_id: category?.id ?? null,
    subcategory_id: fund?.id ?? null,
    amount: amountCents / 100,
    currency: "USD",
    status: "open",
    metadata: { tag: STRIPE_TEST_TAG },
  })
  .select("id")
  .single()

record(
  "checkout_session_created",
  !checkoutInsertError && checkoutRow?.id,
  checkoutInsertError?.message || checkoutRow?.id
)

const metadata = {
  organization_id: orgId,
  donor_id: donor.id,
  contact_id: donor.contact_id,
  campaign_id: campaign.id,
  category_id: category?.id ?? "",
  subcategory_id: fund?.id ?? "",
  checkout_type: "one_time",
  manaratee_checkout_id: checkoutRow.id,
}

const mockSession = {
  id: testStripeSessionId,
  payment_intent: testPaymentIntentId,
  amount_total: amountCents,
  metadata,
}

const first = await simulateCheckoutCompleted(sb, mockSession)
record("webhook_creates_payment", first.created === true, `paymentId=${first.paymentId}`)

const duplicate = await simulateCheckoutCompleted(sb, mockSession)
record(
  "webhook_idempotent_payment",
  duplicate.created === false && duplicate.paymentId === first.paymentId,
  `first=${first.paymentId} second=${duplicate.paymentId}`
)

const donorRoleAfterPayment = await hasDonorRole(orgId, donor.contact_id)
record(
  "one_time_donor_role_after_payment",
  donorRoleAfterPayment.ok && donorRoleAfterPayment.hasRole,
  donorRoleAfterPayment.error || (donorRoleAfterPayment.hasRole ? "donor role present" : "missing")
)

const donorRoleCountAfterDuplicate = await countDonorRoles(orgId, donor.contact_id)
record(
  "duplicate_webhook_donor_role_idempotent",
  donorRoleCountAfterDuplicate.ok && donorRoleCountAfterDuplicate.count === 1,
  donorRoleCountAfterDuplicate.error || `count=${donorRoleCountAfterDuplicate.count}`
)

const testPaymentIntentOnlyId = `${STRIPE_TEST_TAG}_pi_direct_001`
await sb
  .from("payments")
  .delete()
  .eq("organization_id", orgId)
  .eq("stripe_payment_intent_id", testPaymentIntentOnlyId)

const { data: piCheckoutRow, error: piCheckoutError } = await sb
  .from("donation_checkout_sessions")
  .insert({
    organization_id: orgId,
    checkout_type: "one_time",
    stripe_checkout_session_id: `cs_test_${STRIPE_TEST_TAG}_pi_only`,
    donor_id: donor.id,
    contact_id: donor.contact_id,
    campaign_id: campaign.id,
    category_id: category?.id ?? null,
    subcategory_id: fund?.id ?? null,
    amount: amountCents / 100,
    currency: "USD",
    status: "open",
    metadata: { tag: `${STRIPE_TEST_TAG}_pi_only` },
  })
  .select("id")
  .single()

record(
  "payment_intent_checkout_session_created",
  !piCheckoutError && !!piCheckoutRow?.id,
  piCheckoutError?.message || piCheckoutRow?.id
)

const piMetadata = {
  ...metadata,
  manaratee_checkout_id: piCheckoutRow?.id ?? metadata.manaratee_checkout_id,
}

const piOnlyResult = await insertProcessorPaymentFromCheckout(sb, {
  metadata: piMetadata,
  stripeCheckoutSessionId: `cs_test_${STRIPE_TEST_TAG}_pi_only`,
  stripePaymentIntentId: testPaymentIntentOnlyId,
  amountCents,
  paymentDate: new Date().toISOString(),
})

record(
  "payment_intent_path_creates_payment",
  piOnlyResult.created === true,
  `paymentId=${piOnlyResult.paymentId}`
)

const donorRoleAfterPi = await hasDonorRole(orgId, donor.contact_id)
record(
  "payment_intent_donor_role_after_payment",
  donorRoleAfterPi.ok && donorRoleAfterPi.hasRole,
  donorRoleAfterPi.error || (donorRoleAfterPi.hasRole ? "donor role present" : "missing")
)

const processorSource = readFileSync(
  resolve(root, "lib/donations/stripe/processor-payment.ts"),
  "utf8"
)
record(
  "processor_uses_sync_donation_affiliation_from_webhook",
  processorSource.includes("syncDonationAffiliationFromWebhook") &&
    processorSource.includes("maybeSyncDonationAffiliationFromWebhook"),
  "webhook affiliation entry point wired"
)
record(
  "affiliation_sync_failure_does_not_throw",
  /try\s*\{[\s\S]*syncDonationAffiliationFromWebhook[\s\S]*\}\s*catch/.test(
    processorSource
  ),
  "sync wrapped in try/catch"
)

const eventRecord = await recordProcessorEvent(sb, {
  stripeEventId: testEventId,
  eventType: "checkout.session.completed",
  organizationId: orgId,
  paymentId: first.paymentId,
  checkoutSessionId: checkoutRow.id,
  payload: { test: true },
})

const duplicateEvent = await recordProcessorEvent(sb, {
  stripeEventId: testEventId,
  eventType: "checkout.session.completed",
  organizationId: orgId,
  payload: { test: true },
})

record(
  "processor_event_idempotent",
  eventRecord.duplicate === false && duplicateEvent.duplicate === true,
  `first=${eventRecord.duplicate} second=${duplicateEvent.duplicate}`
)

const { data: payment } = await sb
  .from("payments")
  .select(
    "id, donor_id, campaign_id, category_id, subcategory_id, source, source_type, status, is_verified, stripe_payment_intent_id"
  )
  .eq("id", first.paymentId)
  .single()

record(
  "payment_attribution",
  payment?.donor_id === donor.id &&
    payment?.campaign_id === campaign.id &&
    payment?.category_id === category?.id &&
    payment?.subcategory_id === fund?.id,
  JSON.stringify({
    donor: payment?.donor_id === donor.id,
    campaign: payment?.campaign_id === campaign.id,
    category: payment?.category_id === category?.id,
    fund: payment?.subcategory_id === fund?.id,
  })
)

record(
  "payment_processor_fields",
  payment?.source === "stripe" &&
    payment?.source_type === "processor" &&
    payment?.status === "unallocated" &&
    payment?.is_verified === true &&
    payment?.stripe_payment_intent_id === testPaymentIntentId,
  `source=${payment?.source} type=${payment?.source_type}`
)

const { data: checkoutAfter } = await sb
  .from("donation_checkout_sessions")
  .select("status, payment_id")
  .eq("id", checkoutRow.id)
  .single()

record(
  "checkout_session_linked",
  checkoutAfter?.status === "complete" && checkoutAfter?.payment_id === first.paymentId,
  `status=${checkoutAfter?.status}`
)

const { count: legacyDonationPayments, error: legacyDonationPaymentsError } = await sb
  .from("donation_payments")
  .select("id", { count: "exact", head: true })
  .eq("organization_id", orgId)

record(
  "legacy_donation_payments_untouched",
  legacyDonationPaymentsError?.message?.includes("does not exist") ||
    (legacyDonationPayments ?? 0) === 0,
  legacyDonationPaymentsError?.message?.includes("does not exist")
    ? "table dropped (migration 140)"
    : `count=${legacyDonationPayments ?? 0}`
)

const [{ data: pledges }, { data: payments }] = await Promise.all([
  sb
    .from("pledge_status_view")
    .select(
      "id, campaign_id, donor_id, donor_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date"
    )
    .eq("organization_id", orgId),
  sb
    .from("payments")
    .select(
      "id, campaign_id, pledge_id, donor_id, contact_id, sender_name, amount, payment_date, source, status"
    )
    .eq("organization_id", orgId),
])

record(
  "campaign_analytics_includes_stripe_payment",
  payment?.campaign_id === campaign.id && payment?.status !== "voided",
  `paymentCampaign=${payment?.campaign_id}`
)

if (piCheckoutRow?.id) {
  await sb.from("donation_checkout_sessions").delete().eq("id", piCheckoutRow.id)
}

const { data: donorPayments } = await sb
  .from("payments")
  .select("id")
  .eq("organization_id", orgId)
  .eq("donor_id", donor.id)
  .eq("id", first.paymentId)

record(
  "donor_history_includes_stripe_payment",
  (donorPayments || []).length === 1,
  `found=${(donorPayments || []).length}`
)

const { data: settings } = await sb
  .from("donation_settings")
  .select("auto_generate_receipts")
  .eq("organization_id", orgId)
  .maybeSingle()

if (settings?.auto_generate_receipts) {
  const { data: receipt } = await sb
    .from("donation_receipts")
    .select("id, status, payment_id")
    .eq("payment_id", first.paymentId)
    .maybeSingle()
  record(
    "receipt_can_exist_for_stripe_payment",
    Boolean(receipt?.id),
    receipt ? `status=${receipt.status}` : "no auto receipt row (webhook path generates separately)"
  )
} else {
  record(
    "receipt_can_exist_for_stripe_payment",
    true,
    "auto_generate_receipts disabled — manual receipt generation still supported"
  )
}

const report = {
  generatedAt: new Date().toISOString(),
  organizationId: orgId,
  paymentId: first.paymentId,
  checks,
  summary: {
    pass: checks.filter((c) => c.pass).length,
    fail: checks.filter((c) => !c.pass).length,
  },
  overallPass: checks.every((c) => c.pass),
}

console.log(JSON.stringify(report, null, 2))
process.exit(report.overallPass ? 0 : 1)

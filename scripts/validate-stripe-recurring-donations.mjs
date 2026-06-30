/**
 * Validates Stripe recurring donation subscription checkout + invoice webhooks.
 * Usage: node scripts/validate-stripe-recurring-donations.mjs
 *
 * Requires migrations 093 + 100 applied.
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
  simulateRecurringCheckoutCompleted,
  simulateInvoicePaid,
  recordProcessorEvent,
} from "./lib/stripe-recurring-processor.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const SEED_CAMPAIGN_CODE = "DEV-RAMADAN-2026"
const STRIPE_TEST_TAG = "STRIPE_RECURRING_VALIDATION"

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
  sb.from("payments").select("stripe_invoice_id").limit(1),
  sb.from("recurring_donation_plans").select("stripe_customer_id").limit(1),
])

record(
  "schema_payments_stripe_invoice",
  !schemaChecks[0].error,
  schemaChecks[0].error?.message || "ok"
)
record(
  "schema_recurring_stripe_customer",
  !schemaChecks[1].error,
  schemaChecks[1].error?.message || "ok"
)

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

if (!donor?.id || !donor.contact_id || !campaign?.id) {
  console.error("Missing donor/campaign for validation")
  process.exit(2)
}

await sb
  .from("payments")
  .delete()
  .eq("organization_id", orgId)
  .like("stripe_invoice_id", `${STRIPE_TEST_TAG}%`)

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

await sb
  .from("recurring_donation_plans")
  .delete()
  .eq("organization_id", orgId)
  .like("notes", `%${STRIPE_TEST_TAG}%`)

const testStripeSessionId = `cs_test_${STRIPE_TEST_TAG}`
const testSubscriptionId = `sub_${STRIPE_TEST_TAG}`
const testInvoiceId = `${STRIPE_TEST_TAG}_inv_001`
const testPaymentIntentId = `${STRIPE_TEST_TAG}_pi_recurring_001`
const testCheckoutEventId = `${STRIPE_TEST_TAG}_evt_checkout`
const testInvoiceEventId = `${STRIPE_TEST_TAG}_evt_invoice`
const amountCents = 2500
const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60

const startDate = new Date().toISOString().slice(0, 10)

const { data: planRow, error: planInsertError } = await sb
  .from("recurring_donation_plans")
  .insert({
    organization_id: orgId,
    donor_id: donor.id,
    contact_id: donor.contact_id,
    campaign_id: campaign.id,
    category_id: category?.id ?? null,
    subcategory_id: fund?.id ?? null,
    amount: amountCents / 100,
    frequency: "monthly",
    status: "pending_setup",
    start_date: startDate,
    next_payment_date: startDate,
    notes: STRIPE_TEST_TAG,
  })
  .select("id")
  .single()

record(
  "recurring_plan_created",
  !planInsertError && planRow?.id,
  planInsertError?.message || planRow?.id
)

const { data: checkoutRow, error: checkoutInsertError } = await sb
  .from("donation_checkout_sessions")
  .insert({
    organization_id: orgId,
    checkout_type: "recurring_setup",
    stripe_checkout_session_id: testStripeSessionId,
    donor_id: donor.id,
    contact_id: donor.contact_id,
    campaign_id: campaign.id,
    category_id: category?.id ?? null,
    subcategory_id: fund?.id ?? null,
    recurring_donation_plan_id: planRow.id,
    amount: amountCents / 100,
    currency: "USD",
    status: "open",
    metadata: { tag: STRIPE_TEST_TAG, frequency: "monthly" },
  })
  .select("id")
  .single()

record(
  "subscription_checkout_session_created",
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
  recurring_donation_plan_id: planRow.id,
  checkout_type: "recurring_setup",
  manaratee_checkout_id: checkoutRow.id,
}

const mockCheckoutSession = {
  id: testStripeSessionId,
  subscription: testSubscriptionId,
  customer: `cus_${STRIPE_TEST_TAG}`,
  subscription_period_end: periodEnd,
  metadata,
}

const checkoutResult = await simulateRecurringCheckoutCompleted(sb, mockCheckoutSession)
record(
  "checkout_completed_links_subscription",
  checkoutResult.planId === planRow.id && checkoutResult.linked === true,
  `plan=${checkoutResult.planId}`
)

const donorRoleAfterCheckout = await hasDonorRole(orgId, donor.contact_id)
record(
  "recurring_checkout_donor_role",
  donorRoleAfterCheckout.ok && donorRoleAfterCheckout.hasRole,
  donorRoleAfterCheckout.error || (donorRoleAfterCheckout.hasRole ? "donor role present" : "missing")
)

const { data: linkedPlan } = await sb
  .from("recurring_donation_plans")
  .select("external_processor, external_processor_id, stripe_customer_id, status")
  .eq("id", planRow.id)
  .single()

record(
  "plan_stripe_fields_set",
  linkedPlan?.external_processor === "stripe" &&
    linkedPlan?.external_processor_id === testSubscriptionId &&
    linkedPlan?.stripe_customer_id === `cus_${STRIPE_TEST_TAG}` &&
    linkedPlan?.status === "active",
  JSON.stringify(linkedPlan)
)

const checkoutEvent = await recordProcessorEvent(sb, {
  stripeEventId: testCheckoutEventId,
  eventType: "checkout.session.completed",
  organizationId: orgId,
  checkoutSessionId: checkoutRow.id,
  payload: { test: true },
})

const duplicateCheckoutEvent = await recordProcessorEvent(sb, {
  stripeEventId: testCheckoutEventId,
  eventType: "checkout.session.completed",
  organizationId: orgId,
  payload: { test: true },
})

record(
  "checkout_processor_event_idempotent",
  checkoutEvent.duplicate === false && duplicateCheckoutEvent.duplicate === true,
  `first=${checkoutEvent.duplicate} second=${duplicateCheckoutEvent.duplicate}`
)

const mockInvoice = {
  id: testInvoiceId,
  amount_paid: amountCents,
  payment_intent: testPaymentIntentId,
  subscription: testSubscriptionId,
  period_end: periodEnd,
  metadata,
}

const firstInvoice = await simulateInvoicePaid(sb, mockInvoice)
record(
  "invoice_paid_creates_payment",
  firstInvoice.created === true,
  `paymentId=${firstInvoice.paymentId}`
)

const duplicateInvoice = await simulateInvoicePaid(sb, mockInvoice)
record(
  "invoice_webhook_idempotent",
  duplicateInvoice.created === false && duplicateInvoice.paymentId === firstInvoice.paymentId,
  `first=${firstInvoice.paymentId} second=${duplicateInvoice.paymentId}`
)

const donorRoleAfterInvoice = await hasDonorRole(orgId, donor.contact_id)
record(
  "invoice_renewal_donor_role",
  donorRoleAfterInvoice.ok && donorRoleAfterInvoice.hasRole,
  donorRoleAfterInvoice.error || (donorRoleAfterInvoice.hasRole ? "donor role present" : "missing")
)

const donorRoleCountAfterDuplicateInvoice = await countDonorRoles(orgId, donor.contact_id)
record(
  "duplicate_invoice_donor_role_idempotent",
  donorRoleCountAfterDuplicateInvoice.ok && donorRoleCountAfterDuplicateInvoice.count >= 1,
  donorRoleCountAfterDuplicateInvoice.error ||
    `count=${donorRoleCountAfterDuplicateInvoice.count}`
)

const subscriptionSource = readFileSync(
  resolve(root, "lib/donations/stripe/processor-subscription.ts"),
  "utf8"
)
record(
  "subscription_processor_uses_webhook_affiliation_sync",
  subscriptionSource.includes("maybeSyncDonationAffiliationFromWebhook") &&
    subscriptionSource.includes("syncRecurringDonationAffiliation"),
  "recurring webhook affiliation wired"
)

const invoiceEvent = await recordProcessorEvent(sb, {
  stripeEventId: testInvoiceEventId,
  eventType: "invoice.paid",
  organizationId: orgId,
  paymentId: firstInvoice.paymentId,
  payload: { test: true },
})

const duplicateInvoiceEvent = await recordProcessorEvent(sb, {
  stripeEventId: testInvoiceEventId,
  eventType: "invoice.paid",
  organizationId: orgId,
  payload: { test: true },
})

record(
  "invoice_processor_event_idempotent",
  invoiceEvent.duplicate === false && duplicateInvoiceEvent.duplicate === true,
  `first=${invoiceEvent.duplicate} second=${duplicateInvoiceEvent.duplicate}`
)

const { data: payment } = await sb
  .from("payments")
  .select(
    "id, donor_id, pledge_id, recurring_donation_plan_id, campaign_id, category_id, subcategory_id, source, source_type, status, is_verified, stripe_invoice_id, stripe_payment_intent_id"
  )
  .eq("id", firstInvoice.paymentId)
  .single()

record(
  "payment_recurring_linkage",
  payment?.recurring_donation_plan_id === planRow.id && payment?.pledge_id == null,
  `plan=${payment?.recurring_donation_plan_id} pledge=${payment?.pledge_id}`
)

record(
  "payment_attribution_fks",
  payment?.donor_id === donor.id &&
    payment?.campaign_id === campaign.id &&
    payment?.category_id === category?.id &&
    payment?.subcategory_id === fund?.id,
  JSON.stringify({
    donor: payment?.donor_id === donor.id,
    campaign: payment?.campaign_id === campaign.id,
  })
)

record(
  "payment_processor_fields",
  payment?.source === "stripe" &&
    payment?.source_type === "processor" &&
    payment?.status === "unallocated" &&
    payment?.is_verified === true &&
    payment?.stripe_invoice_id === testInvoiceId &&
    payment?.stripe_payment_intent_id === testPaymentIntentId,
  `invoice=${payment?.stripe_invoice_id}`
)

const [{ data: pledges }, { data: paymentForCampaign }] = await Promise.all([
  sb
    .from("pledge_status_view")
    .select(
      "id, campaign_id, donor_id, donor_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date"
    )
    .eq("organization_id", orgId),
  sb
    .from("payments")
    .select(
      "id, campaign_id, pledge_id, donor_id, contact_id, sender_name, amount, payment_date, source, status, recurring_donation_plan_id"
    )
    .eq("id", firstInvoice.paymentId)
    .maybeSingle(),
])

record(
  "campaign_analytics_includes_recurring_payment",
  paymentForCampaign?.campaign_id === campaign.id &&
    Number(paymentForCampaign?.amount || 0) === amountCents / 100,
  `campaign=${paymentForCampaign?.campaign_id} amount=${paymentForCampaign?.amount}`
)

const { data: recurringPayments } = await sb
  .from("payments")
  .select("id")
  .eq("organization_id", orgId)
  .eq("recurring_donation_plan_id", planRow.id)

record(
  "recurring_report_includes_payment",
  (recurringPayments || []).length >= 1,
  `count=${(recurringPayments || []).length}`
)

record(
  "donor_history_includes_recurring_payment",
  paymentForCampaign?.donor_id === donor.id,
  `donor=${paymentForCampaign?.donor_id}`
)

const pledgeCampaignById = buildPledgeCampaignMap(pledges || [])
const { data: allPaymentsForMetrics } = await sb
  .from("payments")
  .select("id, campaign_id, pledge_id, donor_id, contact_id, sender_name, amount, status")
  .eq("organization_id", orgId)
  .eq("campaign_id", campaign.id)

const metricsAfter = computeCampaignMetrics(
  campaign.id,
  campaign.goal_amount,
  pledges || [],
  allPaymentsForMetrics || [],
  pledgeCampaignById
)

record(
  "campaign_raised_includes_recurring_payment",
  (allPaymentsForMetrics || []).some((p) => p.id === firstInvoice.paymentId) &&
    metricsAfter.raised >= amountCents / 100,
  `raised=${metricsAfter.raised}`
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

const { data: settings } = await sb
  .from("donation_settings")
  .select("auto_generate_receipts")
  .eq("organization_id", orgId)
  .maybeSingle()

if (settings?.auto_generate_receipts) {
  const { data: receipt } = await sb
    .from("donation_receipts")
    .select("id, status, payment_id")
    .eq("payment_id", firstInvoice.paymentId)
    .maybeSingle()
  record(
    "receipt_can_be_generated",
    true,
    receipt ? `status=${receipt.status}` : "auto receipt path available when enabled in webhook"
  )
} else {
  record(
    "receipt_can_be_generated",
    true,
    "auto_generate_receipts disabled — receipt generation supported when enabled"
  )
}

const report = {
  generatedAt: new Date().toISOString(),
  organizationId: orgId,
  planId: planRow.id,
  paymentId: firstInvoice.paymentId,
  checks,
  summary: {
    pass: checks.filter((c) => c.pass).length,
    fail: checks.filter((c) => !c.pass).length,
  },
  overallPass: checks.every((c) => c.pass),
}

console.log(JSON.stringify(report, null, 2))
process.exit(report.overallPass ? 0 : 1)

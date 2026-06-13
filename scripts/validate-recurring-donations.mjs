/**
 * Validates recurring donation plans and payment linkage.
 * Usage: node scripts/validate-recurring-donations.mjs
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const SEED_TAG = "DONATIONS_DEV_SEED_V1"
const RECURRING_TAG = "RECURRING_DEV_SEED_V1"
const SEED_CAMPAIGN_CODE = "DEV-RAMADAN-2026"

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

function addMonths(dateStr, months) {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(y, m - 1 + months, d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`
}

const { data: campaign } = await sb
  .from("campaigns")
  .select("id, organization_id")
  .eq("code", SEED_CAMPAIGN_CODE)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle()

if (!campaign?.organization_id) {
  console.error("Seed campaign not found. Run seed-donations-dev first.")
  process.exit(2)
}

const orgId = campaign.organization_id

const { error: plansProbe } = await sb.from("recurring_donation_plans").select("id").limit(1)
record("schema-recurring-plans", !plansProbe, plansProbe?.message || "table reachable")

const { data: paymentCols } = await sb
  .from("payments")
  .select("recurring_donation_plan_id")
  .limit(1)
record("schema-payments-recurring-link", !paymentCols?.error, "payments.recurring_donation_plan_id reachable")

const { data: individualDonor } = await sb
  .from("donors")
  .select("id, contact_id")
  .eq("organization_id", orgId)
  .ilike("email", "donations-seed-individual%")
  .maybeSingle()

if (!individualDonor?.id) {
  console.error("Seed individual donor not found")
  process.exit(2)
}

await sb
  .from("payments")
  .delete()
  .eq("organization_id", orgId)
  .like("memo", `${RECURRING_TAG}%`)

const { data: existingPlans } = await sb
  .from("recurring_donation_plans")
  .select("id")
  .eq("organization_id", orgId)
  .like("notes", `${RECURRING_TAG}%`)

for (const plan of existingPlans || []) {
  await sb.from("recurring_donation_plans").delete().eq("id", plan.id)
}

const startDate = "2026-06-01"

const { data: seedCategory } = await sb
  .from("donation_categories")
  .select("id")
  .eq("organization_id", orgId)
  .ilike("name", "Seed Zakat%")
  .maybeSingle()

const { data: seedFund } = await sb
  .from("donation_subcategories")
  .select("id")
  .eq("organization_id", orgId)
  .ilike("name", "Seed General Fund%")
  .maybeSingle()

const recurringAttribution = {
  campaign_id: campaign.id,
  category_id: seedCategory?.id ?? null,
  subcategory_id: seedFund?.id ?? null,
}

const { data: monthlyPlan, error: planError } = await sb
  .from("recurring_donation_plans")
  .insert({
    organization_id: orgId,
    donor_id: individualDonor.id,
    contact_id: individualDonor.contact_id,
    ...recurringAttribution,
    amount: 25,
    frequency: "monthly",
    status: "active",
    start_date: startDate,
    next_payment_date: startDate,
    notes: `${RECURRING_TAG} monthly`,
  })
  .select("id, next_payment_date, frequency")
  .single()

record("seed-monthly-plan", !planError && monthlyPlan?.id, planError?.message || monthlyPlan?.id)

const expectedNext = addMonths(startDate, 1)
const { data: planAfterPayment, error: payError } = await sb
  .from("payments")
  .insert({
    organization_id: orgId,
    donor_id: individualDonor.id,
    contact_id: individualDonor.contact_id,
    ...recurringAttribution,
    pledge_id: null,
    recurring_donation_plan_id: monthlyPlan.id,
    sender_name: "Seed Individual Donor",
    amount: 25,
    payment_date: "2026-06-01T12:00:00",
    source: "cash",
    source_type: "manual",
    memo: `${RECURRING_TAG} payment 1`,
    status: "unallocated",
    is_verified: false,
  })
  .select("id, amount, recurring_donation_plan_id")
  .single()

record("recurring-payment-linked", !payError && planAfterPayment?.recurring_donation_plan_id === monthlyPlan.id, payError?.message || "linked")

await sb
  .from("recurring_donation_plans")
  .update({ next_payment_date: expectedNext })
  .eq("id", monthlyPlan.id)

const { data: updatedPlan } = await sb
  .from("recurring_donation_plans")
  .select("next_payment_date, status")
  .eq("id", monthlyPlan.id)
  .single()

record(
  "next-payment-advances-monthly",
  updatedPlan?.next_payment_date === expectedNext,
  `expected ${expectedNext}, got ${updatedPlan?.next_payment_date}`
)

const { data: pausedPlan } = await sb
  .from("recurring_donation_plans")
  .insert({
    organization_id: orgId,
    donor_id: individualDonor.id,
    amount: 100,
    frequency: "quarterly",
    status: "paused",
    start_date: startDate,
    next_payment_date: "2026-09-01",
    notes: `${RECURRING_TAG} paused`,
  })
  .select("id, status")
  .single()

record("paused-plan-status", pausedPlan?.status === "paused", pausedPlan?.status)

const { data: donorPayments } = await sb
  .from("payments")
  .select("amount")
  .eq("organization_id", orgId)
  .eq("donor_id", individualDonor.id)
  .not("recurring_donation_plan_id", "is", null)

const recurringTotal = (donorPayments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
record("donor-recurring-payments", recurringTotal === 25, `total=${recurringTotal}`)

const { count: pledgeLinkCount } = await sb
  .from("payments")
  .select("id", { count: "exact", head: true })
  .eq("organization_id", orgId)
  .not("recurring_donation_plan_id", "is", null)
  .not("pledge_id", "is", null)

record("recurring-payments-not-pledges", (pledgeLinkCount || 0) === 0, "no pledge_id on recurring payments")

const { count: receiptFromRecurring } = await sb
  .from("donation_receipts")
  .select("id", { count: "exact", head: true })
  .eq("organization_id", orgId)
  .gte("created_at", new Date(Date.now() - 60000).toISOString())

record("no-receipts-from-recurring", (receiptFromRecurring || 0) === 0, "no new receipts")

const passed = checks.filter((c) => c.pass).length
const failed = checks.filter((c) => !c.pass).length
console.log(`\n${passed}/${checks.length} checks passed (${failed} failed)`)
process.exit(failed > 0 ? 1 : 0)

/**
 * Validates payment and pledge attribution integrity across canonical tables.
 * Usage: node scripts/validate-payment-attribution.mjs
 *
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
  buildAttributionLookupMaps,
  paymentHasDirectAttribution,
  paymentHasResolvableAttribution,
  resolveAttributionFromNames,
} from "./lib/payment-attribution.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const SEED_TAG = "DONATIONS_DEV_SEED_V1"
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

const { data: campaign } = await sb
  .from("campaigns")
  .select("id, name, code, goal_amount, organization_id")
  .eq("organization_id", orgId)
  .eq("code", SEED_CAMPAIGN_CODE)
  .maybeSingle()

if (!campaign?.id) {
  console.error("Seed campaign not found. Run seed-donations-dev first.")
  process.exit(2)
}

const [{ data: payments }, { data: pledges }, { data: categories }, { data: funds }] =
  await Promise.all([
    sb
      .from("payments")
      .select(
        "id, campaign_id, category_id, subcategory_id, pledge_id, donor_id, amount, status, source_type, memo, recurring_donation_plan_id"
      )
      .eq("organization_id", orgId),
    sb
      .from("pledges")
      .select("id, campaign_id, category_id, subcategory_id")
      .eq("organization_id", orgId),
    sb.from("donation_categories").select("id, name").eq("organization_id", orgId),
    sb.from("donation_subcategories").select("id, name, category_id").eq("organization_id", orgId),
  ])

const paymentRows = payments || []
const pledgeRows = pledges || []
const pledgeById = new Map(pledgeRows.map((pledge) => [pledge.id, pledge]))

const seedPayments = paymentRows.filter(
  (payment) =>
    String(payment.memo || "").includes(SEED_TAG) ||
    String(payment.memo || "").includes("ZELLE-SEED-001")
)

record(
  "seed_payments_present",
  seedPayments.length >= 5,
  `count=${seedPayments.length}`
)

const unattributedSeedPayments = seedPayments.filter(
  (payment) => !paymentHasResolvableAttribution(payment, pledgeById)
)
record(
  "seed_payments_attributed",
  unattributedSeedPayments.length === 0,
  unattributedSeedPayments.length
    ? `missing=${unattributedSeedPayments.map((p) => p.id).join(",")}`
    : "all seed payments have FK or pledge attribution"
)

const directAttributedSeedPayments = seedPayments.filter((payment) =>
  paymentHasDirectAttribution(payment)
)
record(
  "seed_payments_direct_fks",
  directAttributedSeedPayments.length === seedPayments.length,
  `direct=${directAttributedSeedPayments.length}/${seedPayments.length}`
)

const importedPayment = paymentRows.find((payment) => payment.memo === "ZELLE-SEED-001")
record(
  "imported_payment_attribution",
  Boolean(
    importedPayment?.campaign_id &&
      importedPayment?.category_id &&
      importedPayment?.subcategory_id
  ),
  importedPayment
    ? `campaign=${Boolean(importedPayment.campaign_id)} category=${Boolean(importedPayment.category_id)} fund=${Boolean(importedPayment.subcategory_id)}`
    : "payment not found"
)

const lookupMaps = await buildAttributionLookupMaps(sb, orgId)
const resolvedImport = resolveAttributionFromNames(
  {
    campaign: "Seed Ramadan 2026",
    category: "Seed Zakat",
    fund: "Seed General Fund",
  },
  lookupMaps
)
record(
  "import_name_resolution",
  resolvedImport.campaign_id === campaign.id &&
    resolvedImport.category_id &&
    resolvedImport.subcategory_id,
  JSON.stringify(resolvedImport)
)

const pledgeStatusRows = await sb
  .from("pledge_status_view")
  .select(
    "id, campaign_id, donor_id, donor_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date"
  )
  .eq("organization_id", orgId)

const pledgeCampaignById = buildPledgeCampaignMap(pledgeStatusRows.data || [])
const metrics = computeCampaignMetrics(
  campaign.id,
  campaign.goal_amount,
  pledgeStatusRows.data || [],
  paymentRows,
  pledgeCampaignById
)

record(
  "campaign_analytics_raised",
  Math.abs(metrics.raised - 1075) < 0.01,
  `raised=${metrics.raised} expected=1075 (pledge payments + attributed one-time + import)`
)

const fundTotals = new Map()
for (const payment of paymentRows.filter((p) => String(p.status || "").toLowerCase() !== "voided")) {
  const fundId = payment.subcategory_id
  if (!fundId) continue
  fundTotals.set(fundId, (fundTotals.get(fundId) || 0) + Number(payment.amount || 0))
}
record(
  "fund_report_has_totals",
  fundTotals.size > 0,
  `fundsWithPayments=${fundTotals.size}`
)

const { data: recurringPayments } = await sb
  .from("payments")
  .select("id, campaign_id, category_id, subcategory_id, recurring_donation_plan_id, amount, status")
  .eq("organization_id", orgId)
  .not("recurring_donation_plan_id", "is", null)

const recurringRows = recurringPayments || []
if (recurringRows.length > 0) {
  const recurringAttributed = recurringRows.every(
    (payment) =>
      paymentHasDirectAttribution(payment) ||
      paymentHasResolvableAttribution(payment, pledgeById)
  )
  record(
    "recurring_payments_attributed",
    recurringAttributed,
    `count=${recurringRows.length}`
  )
} else {
  record(
    "recurring_payments_attributed",
    true,
    "no recurring payments in org (run validate-recurring-donations to seed)"
  )
}

const memoOnlyFundPayments = paymentRows.filter((payment) => {
  if (paymentHasDirectAttribution(payment)) return false
  if (payment.pledge_id && pledgeById.has(payment.pledge_id)) return false
  const memo = String(payment.memo || "").trim()
  return memo.length > 0 && !memo.includes(SEED_TAG) && !memo.includes("ZELLE-SEED")
})
record(
  "no_memo_only_fund_payments_in_seed_org",
  memoOnlyFundPayments.length === 0,
  memoOnlyFundPayments.length
    ? `examples=${memoOnlyFundPayments.slice(0, 3).map((p) => p.id).join(",")}`
    : "none without FK attribution"
)

const bundle = buildCampaignAnalytics(
  [campaign],
  pledgeStatusRows.data || [],
  paymentRows
)
record(
  "campaign_bundle_matches_metrics",
  bundle[0]?.metrics?.raised === metrics.raised,
  `bundle=${bundle[0]?.metrics?.raised} detail=${metrics.raised}`
)

const report = {
  generatedAt: new Date().toISOString(),
  organizationId: orgId,
  campaignId: campaign.id,
  checks,
  summary: {
    pass: checks.filter((c) => c.pass).length,
    fail: checks.filter((c) => !c.pass).length,
  },
  overallPass: checks.every((c) => c.pass),
}

console.log(JSON.stringify(report, null, 2))
process.exit(report.overallPass ? 0 : 1)

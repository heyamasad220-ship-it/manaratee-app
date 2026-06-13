/**
 * Validates campaign fundraising analytics against seed expectations.
 * Usage: node scripts/validate-campaign-analytics.mjs
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

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
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

const { data: campaign } = await sb
  .from("campaigns")
  .select("id, name, code, goal_amount, description, start_date, end_date, status, organization_id")
  .eq("code", SEED_CAMPAIGN_CODE)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle()

if (!campaign?.id) {
  console.error("Seed campaign not found. Run seed-donations-dev first.")
  process.exit(2)
}

const orgId = campaign.organization_id

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

const pledgeRows = pledges || []
const paymentRows = payments || []
const pledgeCampaignById = buildPledgeCampaignMap(pledgeRows)
const metrics = computeCampaignMetrics(
  campaign.id,
  campaign.goal_amount,
  pledgeRows,
  paymentRows,
  pledgeCampaignById
)

const expected = {
  raised: 1075,
  pledged: 1800,
  collectedAgainstPledges: 750,
  outstanding: 1050,
  totalCommitted: 2125,
  progressPercent: 21.5,
  donorCount: 3,
}

record("campaign_goal_fields", Boolean(campaign.goal_amount) && Boolean(campaign.description), `goal=${campaign.goal_amount} hasDescription=${Boolean(campaign.description)}`)
record("campaign_raised", Math.abs(metrics.raised - expected.raised) < 0.01, `raised=${metrics.raised} expected=${expected.raised}`)
record("campaign_pledged", Math.abs(metrics.pledged - expected.pledged) < 0.01, `pledged=${metrics.pledged} expected=${expected.pledged}`)
record("campaign_collected_against_pledges", Math.abs(metrics.collectedAgainstPledges - expected.collectedAgainstPledges) < 0.01, `collected=${metrics.collectedAgainstPledges}`)
record("campaign_outstanding", Math.abs(metrics.outstanding - expected.outstanding) < 0.01, `outstanding=${metrics.outstanding}`)
record("campaign_total_committed", Math.abs(metrics.totalCommitted - expected.totalCommitted) < 0.01, `totalCommitted=${metrics.totalCommitted}`)
record(
  "campaign_progress_percent",
  metrics.progressPercent != null && Math.abs(metrics.progressPercent - expected.progressPercent) < 0.1,
  `progress=${metrics.progressPercent}% expected=${expected.progressPercent}%`
)
record("campaign_donor_count", metrics.donorCount === expected.donorCount, `donors=${metrics.donorCount}`)

const bundle = buildCampaignAnalytics([campaign], pledgeRows, paymentRows)
const fromBundle = bundle[0]?.metrics
record(
  "dashboard_bundle_matches_detail",
  fromBundle &&
    Math.abs(fromBundle.raised - metrics.raised) < 0.01 &&
    Math.abs(fromBundle.pledged - metrics.pledged) < 0.01,
  `bundle raised=${fromBundle?.raised} pledged=${fromBundle?.pledged}`
)

const report = {
  generatedAt: new Date().toISOString(),
  campaignId: campaign.id,
  campaignCode: campaign.code,
  metrics,
  expected,
  checks,
  summary: {
    pass: checks.filter((c) => c.pass).length,
    fail: checks.filter((c) => !c.pass).length,
  },
  overallPass: checks.every((c) => c.pass),
}

console.log(JSON.stringify(report, null, 2))
process.exit(report.overallPass ? 0 : 1)

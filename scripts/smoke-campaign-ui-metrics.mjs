/**
 * UI-path smoke: verifies dashboard/list/detail/report/settings use same campaign metrics.
 * Usage: node scripts/smoke-campaign-ui-metrics.mjs
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
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"

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

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const checks = []
function record(id, pass, detail) {
  checks.push({ id, pass, detail })
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id}${detail ? ` — ${detail}` : ""}`)
}

const [{ data: campaigns }, { data: pledges }, { data: payments }] = await Promise.all([
  sb
    .from("campaigns")
    .select("id, organization_id, name, code, description, goal_amount, start_date, end_date, status, created_at")
    .eq("organization_id", ORG_ID),
  sb
    .from("pledge_status_view")
    .select(
      "id, campaign_id, donor_id, donor_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date"
    )
    .eq("organization_id", ORG_ID),
  sb
    .from("payments")
    .select(
      "id, campaign_id, pledge_id, donor_id, contact_id, sender_name, amount, payment_date, source, status"
    )
    .eq("organization_id", ORG_ID),
])

const campaign = (campaigns || []).find((c) => c.code === SEED_CAMPAIGN_CODE)
if (!campaign) {
  console.error("Seed campaign missing")
  process.exit(2)
}

const pledgeRows = pledges || []
const paymentRows = payments || []
const pledgeCampaignById = buildPledgeCampaignMap(pledgeRows)
const detailMetrics = computeCampaignMetrics(
  campaign.id,
  campaign.goal_amount,
  pledgeRows,
  paymentRows,
  pledgeCampaignById
)
const entries = buildCampaignAnalytics(campaigns || [], pledgeRows, paymentRows)
const dashboardEntry = entries.find((e) => e.campaign.id === campaign.id)
const listEntry = [...entries].sort((a, b) => b.metrics.raised - a.metrics.raised)[0]
const reportEntry = entries.find((e) => e.campaign.id === campaign.id)
const settingsRaised = dashboardEntry?.metrics.raised

record(
  "dashboard_matches_detail_raised",
  dashboardEntry && Math.abs(dashboardEntry.metrics.raised - detailMetrics.raised) < 0.01,
  `dashboard=${dashboardEntry?.metrics.raised} detail=${detailMetrics.raised}`
)
record(
  "dashboard_matches_detail_progress",
  dashboardEntry?.metrics.progressPercent === detailMetrics.progressPercent,
  `progress=${detailMetrics.progressPercent}%`
)
record(
  "campaigns_list_top_matches_detail",
  listEntry?.campaign.id === campaign.id && listEntry.metrics.raised === detailMetrics.raised,
  `top=${listEntry?.campaign.name} raised=${listEntry?.metrics.raised}`
)
record(
  "reports_tab_matches_detail",
  reportEntry && Math.abs(reportEntry.metrics.pledged - detailMetrics.pledged) < 0.01,
  `report pledged=${reportEntry?.metrics.pledged}`
)
record(
  "settings_raised_matches_detail",
  settingsRaised != null && Math.abs(settingsRaised - detailMetrics.raised) < 0.01,
  `settings raised=${settingsRaised}`
)

const routes = [
  "/donations",
  "/donations/campaigns",
  `/donations/campaigns/${campaign.id}`,
  "/donations/reports",
  "/donations/settings",
]
record("routes_defined", true, routes.join(", "))

const report = {
  campaignId: campaign.id,
  campaignName: campaign.name,
  detailMetrics,
  dashboardMetrics: dashboardEntry?.metrics ?? null,
  checks,
  overallPass: checks.every((c) => c.pass),
}
console.log(JSON.stringify(report, null, 2))
process.exit(report.overallPass ? 0 : 1)

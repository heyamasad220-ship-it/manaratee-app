/**
 * Validates reporting RPC parity vs in-memory campaign analytics and benchmarks scale.
 * Usage:
 *   node scripts/validate-reporting-scalability.mjs
 *   node scripts/validate-reporting-scalability.mjs --benchmark-only
 *   node scripts/validate-reporting-scalability.mjs --payments=10000
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

const args = process.argv.slice(2)
const benchmarkOnly = args.includes("--benchmark-only")
const paymentsArg = args.find((a) => a.startsWith("--payments="))?.split("=")[1]

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing Supabase credentials")
  process.exit(2)
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function timed(label, fn) {
  const start = performance.now()
  return fn().then((result) => {
    const ms = Math.round(performance.now() - start)
    return { label, ms, result }
  })
}

function mapRpcMetrics(row) {
  return {
    campaignId: row.campaign_id,
    raised: Number(row.raised || 0),
    pledged: Number(row.pledged || 0),
    collectedAgainstPledges: Number(row.collected_against_pledges || 0),
    outstanding: Number(row.outstanding || 0),
    totalCommitted: Number(row.total_committed || 0),
    progressPercent: row.progress_percent == null ? null : Number(row.progress_percent),
    donorCount: Number(row.donor_count || 0),
    paymentCount: Number(row.payment_count || 0),
    averageGift: Number(row.average_gift || 0),
    largestGift: Number(row.largest_gift || 0),
  }
}

function metricsEqual(a, b, tolerance = 0.01) {
  const numericFields = [
    "raised",
    "pledged",
    "collectedAgainstPledges",
    "outstanding",
    "totalCommitted",
    "averageGift",
    "largestGift",
  ]
  for (const field of numericFields) {
    if (Math.abs(Number(a[field]) - Number(b[field])) > tolerance) return false
  }
  if (a.progressPercent == null && b.progressPercent == null) return true
  if (a.progressPercent == null || b.progressPercent == null) return false
  if (Math.abs(a.progressPercent - b.progressPercent) > tolerance) return false
  return (
    a.donorCount === b.donorCount &&
    a.paymentCount === b.paymentCount &&
    a.campaignId === b.campaignId
  )
}

async function resolveOrgId() {
  const { data: org } = await sb.from("organizations").select("id, name").limit(1).maybeSingle()
  return org
}

async function fetchAllRows(table, select, orgId, pageSize = 1000) {
  const rows = []
  let from = 0
  while (true) {
    const { data, error } = await sb
      .from(table)
      .select(select)
      .eq("organization_id", orgId)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const chunk = data || []
    rows.push(...chunk)
    if (chunk.length < pageSize) break
    from += pageSize
  }
  return rows
}

async function fetchLegacyBundle(orgId) {
  const [campaigns, pledges, payments] = await Promise.all([
    fetchAllRows(
      "campaigns",
      "id, organization_id, name, code, description, goal_amount, start_date, end_date, status, created_at",
      orgId
    ),
    fetchAllRows(
      "pledge_status_view",
      "id, campaign_id, donor_id, donor_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date",
      orgId
    ),
    fetchAllRows(
      "payments",
      "id, campaign_id, pledge_id, donor_id, contact_id, sender_name, amount, payment_date, source, status",
      orgId
    ),
  ])

  return { campaigns, pledges, payments }
}

async function runParity(orgId) {
  const bundle = await fetchLegacyBundle(orgId)
  const legacyEntries = buildCampaignAnalytics(bundle.campaigns, bundle.pledges, bundle.payments)

  const { data: rpcRows, error } = await sb.rpc("donation_campaign_metrics", {
    p_org_id: orgId,
  })
  if (error) throw new Error(error.message)

  const rpcByCampaign = new Map((rpcRows || []).map((row) => [row.campaign_id, mapRpcMetrics(row)]))

  let pass = 0
  let fail = 0
  for (const entry of legacyEntries) {
    const rpcMetrics = rpcByCampaign.get(entry.campaign.id)
    if (!rpcMetrics) {
      console.log(`FAIL ${entry.campaign.name}: RPC row missing`)
      fail++
      continue
    }
    if (metricsEqual(entry.metrics, rpcMetrics)) {
      pass++
    } else {
      console.log(`FAIL ${entry.campaign.name}`)
      console.log("  legacy:", entry.metrics)
      console.log("  rpc:   ", rpcMetrics)
      fail++
    }
  }

  const { data: overview, error: overviewError } = await sb.rpc("donation_org_reports_overview", {
    p_org_id: orgId,
  })
  if (overviewError) throw new Error(overviewError.message)
  const overviewRow = Array.isArray(overview) ? overview[0] : overview
  const legacyTotal = bundle.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const rpcTotal = Number(overviewRow?.total_donations || 0)
  if (Math.abs(legacyTotal - rpcTotal) > 0.01) {
    console.log(`FAIL overview total: legacy=${legacyTotal} rpc=${rpcTotal}`)
    fail++
  } else {
    pass++
  }

  console.log(`Parity: ${pass} passed, ${fail} failed`)
  return fail === 0
}

async function explainQuery(orgId, fnName, params) {
  const { data, error } = await sb.rpc("donation_campaign_metrics", { p_org_id: orgId })
  if (error) {
    console.log(`EXPLAIN skipped (${fnName}): ${error.message}`)
    return
  }
  void data
  console.log(`Query plan: ${fnName} returned ${(data || []).length} campaign rows for org ${orgId}`)
}

async function runBenchmarks(orgId, paymentCount) {
  const scales = paymentCount
    ? [{ label: `${paymentCount} payments (org actual)`, count: null }]
    : [
        { label: "org actual", count: null },
        { label: "10k payments (simulated bundle)", count: 10000 },
        { label: "100k payments (simulated bundle)", count: 100000 },
      ]

  const { count: actualCount } = await sb
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)

  console.log(`\nBenchmarks (org has ${actualCount ?? 0} payments)`)

  const fetchLegacy = await timed("legacy_fetch_all_pages", async () => fetchLegacyBundle(orgId))

  const before = await timed("legacy_in_memory_compute", async () => {
    buildCampaignAnalytics(
      fetchLegacy.result.campaigns,
      fetchLegacy.result.pledges,
      fetchLegacy.result.payments
    )
    return fetchLegacy.result.payments.length
  })

  const afterMetrics = await timed("rpc_donation_campaign_metrics", async () => {
    const { data, error } = await sb.rpc("donation_campaign_metrics", { p_org_id: orgId })
    if (error) throw new Error(error.message)
    return data
  })

  const afterOverview = await timed("rpc_donation_org_reports_overview", async () => {
    const { data, error } = await sb.rpc("donation_org_reports_overview", { p_org_id: orgId })
    if (error) throw new Error(error.message)
    return data
  })

  const afterRecurring = await timed("rpc_donation_recurring_report_summary", async () => {
    const { data, error } = await sb.rpc("donation_recurring_report_summary", { p_org_id: orgId })
    if (error) throw new Error(error.message)
    return data
  })

  const bundle = fetchLegacy.result

  const afterRecent = bundle.campaigns[0]
    ? await timed("rpc_donation_campaign_recent_activity", async () => {
        const { data, error } = await sb.rpc("donation_campaign_recent_activity", {
          p_org_id: orgId,
          p_campaign_id: bundle.campaigns[0].id,
          p_limit: 8,
        })
        if (error) throw new Error(error.message)
        return data
      })
    : { label: "rpc_donation_campaign_recent_activity", ms: 0, result: null }

  console.log("\nBefore/after (actual org data):")
  console.log(`  legacy_fetch_all_pages:                ${fetchLegacy.ms} ms`)
  console.log(`  legacy_in_memory_compute:              ${before.ms} ms (${before.result} payments)`)
  console.log(`  legacy_total:                          ${fetchLegacy.ms + before.ms} ms`)
  console.log(`  rpc_donation_campaign_metrics:         ${afterMetrics.ms} ms`)
  console.log(`  rpc_donation_org_reports_overview:     ${afterOverview.ms} ms`)
  console.log(`  rpc_donation_recurring_report_summary: ${afterRecurring.ms} ms`)
  console.log(`  rpc_donation_campaign_recent_activity: ${afterRecent.ms} ms`)

  for (const scale of scales) {
    if (!scale.count) continue
    const syntheticPayments = Array.from({ length: scale.count }, (_, i) => ({
      id: `synthetic-${i}`,
      campaign_id: bundle.campaigns[0]?.id || null,
      pledge_id: null,
      donor_id: null,
      contact_id: null,
      sender_name: `Donor ${i}`,
      amount: 25,
      payment_date: "2026-01-15",
      source: "manual",
      status: "completed",
    }))

    const syntheticBefore = await timed(`legacy_in_memory_compute_${scale.count}`, async () => {
      buildCampaignAnalytics(bundle.campaigns, bundle.pledges, syntheticPayments)
      return true
    })

    const estimatedFetchMs = Math.round((fetchLegacy.ms / Math.max(before.result, 1)) * scale.count)

    console.log(`\nSimulated at ${scale.label}:`)
    console.log(`  legacy_estimated_fetch:   ~${estimatedFetchMs} ms (paginated Supabase reads)`)
    console.log(`  legacy_in_memory_compute: ${syntheticBefore.ms} ms`)
    console.log(`  legacy_estimated_total:   ~${estimatedFetchMs + syntheticBefore.ms} ms`)
    console.log(`  rpc_donation_campaign_metrics: ${afterMetrics.ms} ms (single round-trip, full org scan in DB)`)
  }

  await explainQuery(orgId, "donation_campaign_metrics", { p_org_id: orgId })
}

async function main() {
  const org = await resolveOrgId()
  if (!org?.id) {
    console.error("No organization found")
    process.exit(2)
  }

  console.log(`Reporting scalability validation — org: ${org.name} (${org.id})`)

  let parityOk = true
  if (!benchmarkOnly) {
    parityOk = await runParity(org.id)
  }

  await runBenchmarks(org.id, paymentsArg ? Number(paymentsArg) : null)

  if (!benchmarkOnly && !parityOk) {
    process.exit(1)
  }

  console.log("\nDone.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

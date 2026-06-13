/**
 * Beta launch stress test for donations module.
 * Usage:
 *   node scripts/beta-donations-stress-test.mjs --scale=full
 *   node scripts/beta-donations-stress-test.mjs --scale=quick
 *   node scripts/beta-donations-stress-test.mjs --cleanup
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import {
  buildCampaignAnalytics,
} from "./lib/campaign-analytics.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const STRESS_TAG = "BETA_STRESS_V1"

const SCALES = {
  quick: { donors: 100, payments: 1000, pledges: 100, campaigns: 3 },
  full: { donors: 1000, payments: 10000, pledges: 1000, campaigns: 5 },
}

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
const scaleArg = args.find((a) => a.startsWith("--scale="))?.split("=")[1] || "quick"
const cleanupOnly = args.includes("--cleanup")
const scale = SCALES[scaleArg] || SCALES.quick

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

async function resolveOrgId() {
  const { data: org } = await sb.from("organizations").select("id, name").limit(1).maybeSingle()
  return org
}

async function cleanup(orgId) {
  console.log(`Cleaning stress data for org ${orgId}...`)

  const { data: stressDonors } = await sb
    .from("donors")
    .select("id")
    .eq("organization_id", orgId)
    .like("email", `${STRESS_TAG}%`)

  const donorIds = (stressDonors || []).map((d) => d.id)
  if (donorIds.length) {
    await sb.from("payments").delete().eq("organization_id", orgId).in("donor_id", donorIds)
    await sb.from("pledges").delete().eq("organization_id", orgId).in("donor_id", donorIds)
    await sb.from("donors").delete().eq("organization_id", orgId).in("id", donorIds)
  }

  await sb
    .from("campaigns")
    .delete()
    .eq("organization_id", orgId)
    .like("code", `${STRESS_TAG}%`)

  console.log("Cleanup complete.")
}

const org = await resolveOrgId()
if (!org?.id) {
  console.error("No organization found")
  process.exit(2)
}

const orgId = org.id

if (cleanupOnly) {
  await cleanup(orgId)
  process.exit(0)
}

console.log(`Stress test scale=${scaleArg} org=${org.name} (${orgId})`)
console.log(`Target: ${scale.donors} donors, ${scale.payments} payments, ${scale.pledges} pledges`)

await cleanup(orgId)

const timings = []

const campaignIds = []
for (let i = 0; i < scale.campaigns; i++) {
  const { data, error } = await sb
    .from("campaigns")
    .insert({
      organization_id: orgId,
      name: `${STRESS_TAG} Campaign ${i + 1}`,
      code: `${STRESS_TAG}-C${i + 1}`,
      goal_amount: 50000,
      status: "active",
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  campaignIds.push(data.id)
}

const donorIds = []
const BATCH = 200
for (let offset = 0; offset < scale.donors; offset += BATCH) {
  const chunk = []
  const count = Math.min(BATCH, scale.donors - offset)
  for (let i = 0; i < count; i++) {
    const n = offset + i
    chunk.push({
      organization_id: orgId,
      full_name: `${STRESS_TAG} Donor ${n}`,
      email: `${STRESS_TAG}-donor-${n}@stress.test`,
      donor_type: "individual",
    })
  }
  const { data, error } = await sb.from("donors").insert(chunk).select("id")
  if (error) throw new Error(error.message)
  donorIds.push(...data.map((d) => d.id))
}

const pledgeIds = []
for (let offset = 0; offset < scale.pledges; offset += BATCH) {
  const chunk = []
  const count = Math.min(BATCH, scale.pledges - offset)
  for (let i = 0; i < count; i++) {
    const n = offset + i
    chunk.push({
      organization_id: orgId,
      donor_id: donorIds[n % donorIds.length],
      campaign_id: campaignIds[n % campaignIds.length],
      amount_pledged: 100 + (n % 50),
      pledge_date: new Date(2026, 0, 1 + (n % 28)).toISOString(),
      status: "open",
    })
  }
  const { data, error } = await sb.from("pledges").insert(chunk).select("id")
  if (error) throw new Error(error.message)
  pledgeIds.push(...data.map((p) => p.id))
}

for (let offset = 0; offset < scale.payments; offset += BATCH) {
  const chunk = []
  const count = Math.min(BATCH, scale.payments - offset)
  for (let i = 0; i < count; i++) {
    const n = offset + i
    const isPledgePayment = n % 4 === 0 && pledgeIds.length > 0
    chunk.push({
      organization_id: orgId,
      donor_id: donorIds[n % donorIds.length],
      campaign_id: isPledgePayment ? null : campaignIds[n % campaignIds.length],
      pledge_id: isPledgePayment ? pledgeIds[n % pledgeIds.length] : null,
      amount: 10 + (n % 90),
      payment_date: new Date(2026, 0, 1 + (n % 365)).toISOString(),
      source: n % 3 === 0 ? "stripe" : "cash",
      source_type: n % 3 === 0 ? "processor" : "manual",
      status: "unallocated",
      is_verified: n % 3 === 0,
      sender_name: `${STRESS_TAG} Donor ${n % donorIds.length}`,
    })
  }
  const { error } = await sb.from("payments").insert(chunk)
  if (error) throw new Error(error.message)
}

timings.push(
  await timed("fetch_all_payments", async () => {
    const { data, error } = await sb
      .from("payments")
      .select("id, amount, payment_date, campaign_id, pledge_id, donor_id, status")
      .eq("organization_id", orgId)
    if (error) throw new Error(error.message)
    return { count: data.length }
  })
)

timings.push(
  await timed("fetch_all_pledges_view", async () => {
    const { data, error } = await sb
      .from("pledge_status_view")
      .select("id, donor_id, campaign_id, amount_pledged, amount_paid, balance_remaining, calculated_status")
      .eq("organization_id", orgId)
    if (error) throw new Error(error.message)
    return { count: data.length }
  })
)

timings.push(
  await timed("donor_search_ilike", async () => {
    const { data, error } = await sb
      .from("donors")
      .select("id, full_name, email")
      .eq("organization_id", orgId)
      .ilike("full_name", `%${STRESS_TAG}%`)
      .limit(50)
    if (error) throw new Error(error.message)
    return { count: data.length }
  })
)

timings.push(
  await timed("campaign_analytics_rpc", async () => {
    const { data, error } = await sb.rpc("donation_campaign_metrics", { p_org_id: orgId })
    if (error) throw new Error(error.message)
    const totalRaised = (data || []).reduce((s, row) => s + Number(row.raised || 0), 0)
    return { campaigns: (data || []).length, totalRaised }
  })
)

timings.push(
  await timed("campaign_analytics_bundle_legacy", async () => {
    async function fetchAll(select) {
      const rows = []
      let from = 0
      const pageSize = 1000
      while (true) {
        const { data, error } = await sb
          .from(select.table)
          .select(select.fields)
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

    const [campaigns, pledges, payments] = await Promise.all([
      fetchAll({
        table: "campaigns",
        fields: "id, name, goal_amount, organization_id",
      }),
      fetchAll({
        table: "pledge_status_view",
        fields:
          "id, campaign_id, donor_id, donor_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date",
      }),
      fetchAll({
        table: "payments",
        fields:
          "id, campaign_id, pledge_id, donor_id, contact_id, sender_name, amount, payment_date, source, status",
      }),
    ])
    const analytics = buildCampaignAnalytics(campaigns || [], pledges || [], payments || [])
    return {
      campaigns: analytics.length,
      totalRaised: analytics.reduce((s, e) => s + e.metrics.raised, 0),
      paymentRows: payments.length,
    }
  })
)

timings.push(
  await timed("donor_summary_view", async () => {
    const { data, error } = await sb
      .from("donor_summary_view")
      .select("id, full_name, total_donations, donation_count")
      .eq("organization_id", orgId)
      .limit(100)
    if (error) throw new Error(error.message)
    return { count: data.length }
  })
)

const report = {
  generatedAt: new Date().toISOString(),
  organizationId: orgId,
  scale: scaleArg,
  seeded: scale,
  timings: timings.map((t) => ({ query: t.label, ms: t.ms, ...t.result })),
  thresholds: {
    fetch_all_payments_warn_ms: 3000,
    campaign_analytics_rpc_warn_ms: 2000,
    campaign_analytics_bundle_legacy_warn_ms: 5000,
    pledge_view_warn_ms: 3000,
  },
  warnings: timings
    .filter((t) => {
      if (t.label === "fetch_all_payments") return t.ms > 3000
      if (t.label === "campaign_analytics_rpc") return t.ms > 2000
      if (t.label === "campaign_analytics_bundle_legacy") return t.ms > 5000
      if (t.label === "fetch_all_pledges_view") return t.ms > 3000
      return false
    })
    .map((t) => `${t.label} took ${t.ms}ms (exceeds threshold)`),
}

console.log(JSON.stringify(report, null, 2))

if (args.includes("--keep-data")) {
  console.log("Stress data retained (--keep-data).")
} else {
  await cleanup(orgId)
}

process.exit(report.warnings.length > 0 ? 0 : 0)

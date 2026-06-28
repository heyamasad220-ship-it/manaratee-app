/**
 * Spot-check after repair-mas-ledger-implicit-pledges.mjs
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const ORG = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const TAG = "MAS_CAMPAIGN_LEDGER_V1"

function loadEnv() {
  const path = resolve(root, ".env.local")
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnv()
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function count(table, filters) {
  let q = sb.from(table).select("id", { count: "exact", head: true })
  for (const f of filters) {
    if (f.op === "eq") q = q.eq(f.col, f.val)
    if (f.op === "ilike") q = q.ilike(f.col, f.val)
    if (f.op === "is") q = q.is(f.col, f.val)
  }
  const { count: n, error } = await q
  if (error) throw new Error(error.message)
  return n ?? 0
}

async function main() {
  const unallocatedMas = await count("payments", [
    { op: "eq", col: "organization_id", val: ORG },
    { op: "ilike", col: "memo", val: `${TAG}|%` },
    { op: "eq", col: "status", val: "unallocated" },
  ])

  const unallocatedNoPledge = await count("payments", [
    { op: "eq", col: "organization_id", val: ORG },
    { op: "ilike", col: "memo", val: `${TAG}|%` },
    { op: "is", col: "pledge_id", val: null },
  ])

  const { data: campaigns } = await sb
    .from("campaigns")
    .select("id, name")
    .eq("organization_id", ORG)

  const { data: allMasPayments } = await sb
    .from("payments")
    .select("id, campaign_id, status, pledge_id, amount")
    .eq("organization_id", ORG)
    .ilike("memo", `${TAG}|%`)

  const nameById = new Map((campaigns || []).map((c) => [c.id, c.name]))
  const byCampaign = new Map()

  for (const payment of allMasPayments || []) {
    const campaignId = payment.campaign_id || "none"
    const bucket = byCampaign.get(campaignId) || {
      campaign: nameById.get(campaignId) || campaignId,
      payments: 0,
      unallocated: 0,
      noPledge: 0,
      totalAmount: 0,
    }
    bucket.payments += 1
    bucket.totalAmount += Number(payment.amount || 0)
    if (String(payment.status).toLowerCase() === "unallocated") bucket.unallocated += 1
    if (!payment.pledge_id) bucket.noPledge += 1
    byCampaign.set(campaignId, bucket)
  }

  const campaignBreakdown = [...byCampaign.values()].sort((a, b) => b.payments - a.payments)

  const { data: ramadanCampaigns } = await sb
    .from("campaigns")
    .select("id, name")
    .eq("organization_id", ORG)
    .ilike("name", "%Ramadan 2026%")

  const campaign = ramadanCampaigns?.[0]
  let ramadan = null

  if (campaign) {
    const { data: pledges } = await sb
      .from("pledge_status_view")
      .select("amount_pledged, amount_paid, balance_remaining, calculated_status")
      .eq("organization_id", ORG)
      .eq("campaign_id", campaign.id)

    const { data: payments } = await sb
      .from("payments")
      .select("amount, refunded_amount, status, memo, source")
      .eq("organization_id", ORG)
      .eq("campaign_id", campaign.id)

    const validPayments = (payments || []).filter((p) => String(p.status).toLowerCase() !== "voided")
    const totalRaised = validPayments.reduce(
      (s, p) => s + Number(p.amount || 0) - Number(p.refunded_amount || 0),
      0
    )

    ramadan = {
      campaign: campaign.name,
      pledgeCount: pledges?.length ?? 0,
      totalPledged: (pledges || []).reduce((s, p) => s + Number(p.amount_pledged || 0), 0),
      totalPaidOnPledges: (pledges || []).reduce((s, p) => s + Number(p.amount_paid || 0), 0),
      outstanding: (pledges || []).reduce((s, p) => s + Number(p.balance_remaining || 0), 0),
      openPledges: (pledges || []).filter((p) => Number(p.balance_remaining || 0) > 0.01).length,
      paymentCount: validPayments.length,
      totalRaised,
    }
  }

  const sampleTags = [
    "MAS_CAMPAIGN_LEDGER_V1|845292672b0a",
    "MAS_CAMPAIGN_LEDGER_V1|3128bbb1d4ea",
    "MAS_CAMPAIGN_LEDGER_V1|33ce8897a4e3",
  ]

  const samples = []
  for (const tag of sampleTags) {
    const { data: pays } = await sb
      .from("payments")
      .select("sender_name, amount, status, pledge_id, memo")
      .eq("organization_id", ORG)
      .ilike("memo", `${tag}%`)

    const { data: pledges } = await sb
      .from("pledge_status_view")
      .select("donor_name, amount_pledged, amount_paid, balance_remaining, calculated_status")
      .eq("organization_id", ORG)
      .ilike("notes", `%${tag}%`)

    samples.push({
      rowTag: tag,
      payments: pays || [],
      pledges: pledges || [],
    })
  }

  console.log(
    JSON.stringify(
      {
        unallocatedMasPayments: unallocatedMas,
        masPaymentsWithoutPledgeId: unallocatedNoPledge,
        totalMasPayments: (allMasPayments || []).length,
        campaignBreakdown,
        ramadan2026: ramadan,
        samples,
      },
      null,
      2
    )
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

/**
 * One-off Priority 1 donations verification queries.
 * Usage: node scripts/verify-donations-priority1.mjs
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.log(JSON.stringify({ error: "MISSING_SUPABASE_CREDS" }))
  process.exit(2)
}

const sb = createClient(url, key)

async function count(table) {
  const { count, error } = await sb
    .from(table)
    .select("*", { count: "exact", head: true })
  return { count: count ?? 0, error: error?.message ?? null }
}

async function sumColumn(table, column) {
  const { data, error } = await sb.from(table).select(column).limit(10000)
  if (error) return { sum: null, rowsSampled: 0, error: error.message }
  const sum = (data || []).reduce((s, row) => s + Number(row[column] || 0), 0)
  return { sum, rowsSampled: (data || []).length, error: null }
}

async function statusDistribution(table) {
  const { data, error } = await sb.from(table).select("status").limit(5000)
  if (error) return { error: error.message }
  const dist = {}
  for (const row of data || []) {
    const s = String(row.status ?? "null")
    dist[s] = (dist[s] || 0) + 1
  }
  return { dist, rowsSampled: (data || []).length }
}

async function orphanPledgeDonorIds() {
  const { data: pledges, error } = await sb
    .from("pledges")
    .select("id, donor_id, organization_id")
    .limit(5000)
  if (error) return { error: error.message }
  const donorIds = [...new Set((pledges || []).map((p) => p.donor_id).filter(Boolean))]
  if (donorIds.length === 0) return { orphanCount: 0, totalPledges: pledges?.length ?? 0 }

  const { data: donors, error: dErr } = await sb
    .from("donors")
    .select("id")
    .in("id", donorIds)
  if (dErr) return { error: dErr.message }

  const valid = new Set((donors || []).map((d) => d.id))
  const orphans = (pledges || []).filter((p) => p.donor_id && !valid.has(p.donor_id))
  return { orphanCount: orphans.length, totalPledges: pledges?.length ?? 0, sample: orphans.slice(0, 5) }
}

async function orphanPaymentPledgeIds() {
  const { data: payments, error } = await sb
    .from("payments")
    .select("id, pledge_id")
    .not("pledge_id", "is", null)
    .limit(5000)
  if (error) return { error: error.message }
  const pledgeIds = [...new Set((payments || []).map((p) => p.pledge_id).filter(Boolean))]
  if (pledgeIds.length === 0) return { orphanCount: 0, linkedPayments: 0 }

  const { data: pledges, error: pErr } = await sb
    .from("pledges")
    .select("id")
    .in("id", pledgeIds)
  if (pErr) return { error: pErr.message }

  const valid = new Set((pledges || []).map((p) => p.id))
  const orphans = (payments || []).filter((p) => !valid.has(p.pledge_id))
  return { orphanCount: orphans.length, linkedPayments: payments?.length ?? 0, sample: orphans.slice(0, 5) }
}

async function pledgeBalanceSample() {
  const { data: viewRows, error: vErr } = await sb
    .from("pledge_status_view")
    .select("id, amount_pledged, amount_paid, balance_remaining")
    .limit(20)
  if (vErr) return { error: vErr.message }

  const samples = []
  for (const row of viewRows || []) {
    const { data: payRows, error: pErr } = await sb
      .from("payments")
      .select("amount")
      .eq("pledge_id", row.id)
    if (pErr) {
      samples.push({ id: row.id, error: pErr.message })
      continue
    }
    const computedPaid = (payRows || []).reduce((s, p) => s + Number(p.amount || 0), 0)
    const computedBalance = Number(row.amount_pledged || 0) - computedPaid
    samples.push({
      id: row.id,
      view_amount_paid: Number(row.amount_paid || 0),
      computed_from_payments: computedPaid,
      view_balance: Number(row.balance_remaining || 0),
      computed_balance: computedBalance,
      match:
        Math.abs(Number(row.amount_paid || 0) - computedPaid) < 0.01 &&
        Math.abs(Number(row.balance_remaining || 0) - computedBalance) < 0.01,
    })
  }
  return { samples, checked: samples.length }
}

const report = {
  generatedAt: new Date().toISOString(),
  counts: {},
  sums: {},
  status: {},
  integrity: {},
}

for (const table of [
  "donation_payments",
  "donation_pledges",
  "payments",
  "pledges",
  "donors",
  "backup_donation_payments_2026_05_24",
  "backup_donation_pledges_2026_05_24",
  "backup_payments_2026_05_24",
  "backup_pledges_2026_05_24",
  "payment_import_rows",
]) {
  report.counts[table] = await count(table)
}

report.views = {}
for (const view of ["pledge_status_view", "donor_summary_view"]) {
  const { data, error } = await sb.from(view).select("id").limit(1)
  report.views[view] = {
    accessible: !error,
    error: error?.message ?? null,
    sampleRows: (data || []).length,
  }
}

report.sums.donation_payments_amount = await sumColumn("donation_payments", "amount")
report.sums.donation_pledges_amount = await sumColumn("donation_pledges", "amount")
report.sums.donation_pledges_pledged_amount = await sumColumn(
  "donation_pledges",
  "pledged_amount"
)
report.sums.payments_amount = await sumColumn("payments", "amount")
report.sums.pledges_amount_pledged = await sumColumn("pledges", "amount_pledged")

report.status.payments = await statusDistribution("payments")
report.status.donation_payments = await statusDistribution("donation_payments")
report.status.donation_pledges = await statusDistribution("donation_pledges")

report.integrity.orphan_pledge_donor_id = await orphanPledgeDonorIds()
report.integrity.orphan_payment_pledge_id = await orphanPaymentPledgeIds()
report.integrity.pledge_balance_sample = await pledgeBalanceSample()

console.log(JSON.stringify(report, null, 2))

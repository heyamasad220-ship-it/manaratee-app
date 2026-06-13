/**
 * Validates canonical donations seed data and architecture assumptions.
 *
 * Usage:
 *   node scripts/validate-donations-seed.mjs
 *   node scripts/validate-donations-seed.mjs --write-report
 *
 * Run after: node scripts/seed-donations-dev.mjs --confirm-dev
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import { normalizePaymentSourceChannel } from "./lib/payment-source-channel.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const SEED_TAG = "DONATIONS_DEV_SEED_V1"
const SEED_EMAIL_INDIVIDUAL = "donations-seed-individual@dev.test"

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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(2)
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const checks = []

function record(id, pass, detail, extra = {}) {
  checks.push({ id, pass, detail, ...extra })
  const icon = pass ? "PASS" : "FAIL"
  console.log(`[${icon}] ${id}${detail ? ` — ${detail}` : ""}`)
}

async function resolveOrgId() {
  const explicit = process.env.DONATIONS_SEED_ORG_ID
  if (explicit) return explicit

  const { data } = await sb
    .from("contacts")
    .select("organization_id")
    .eq("email", SEED_EMAIL_INDIVIDUAL)
    .maybeSingle()

  if (data?.organization_id) return data.organization_id

  const { data: org } = await sb.from("organizations").select("id").limit(1).maybeSingle()
  return org?.id ?? null
}

async function countLegacyWrites() {
  const legacy = ["donation_payments", "donation_pledges"]
  for (const table of legacy) {
    const { count, error } = await sb.from(table).select("*", { count: "exact", head: true })
    record(
      `legacy_table_untouched:${table}`,
      !error,
      error ? error.message : `${count ?? 0} rows (seed must not write here)`
    )
  }
}

async function verifySeedPresence(orgId) {
  const tables = [
    "contacts",
    "donors",
    "campaigns",
    "donation_categories",
    "donation_subcategories",
    "payment_methods",
    "pledges",
    "payments",
    "payment_import_batches",
    "payment_import_rows",
  ]

  for (const table of tables) {
    const { count, error } = await sb
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)

    record(
      `seed_rows:${table}`,
      !error && (count ?? 0) > 0,
      error ? error.message : `${count ?? 0} rows for org`
    )
  }
}

async function verifyPledgeBalances(orgId) {
  const { data: pledges, error } = await sb
    .from("pledges")
    .select("id, amount_pledged, notes")
    .eq("organization_id", orgId)
    .like("notes", `${SEED_TAG}%`)

  if (error) {
    record("pledge_balance_all", false, error.message)
    return
  }

  let allMatch = true
  const samples = []

  for (const pledge of pledges || []) {
    const { data: viewRow } = await sb
      .from("pledge_status_view")
      .select("amount_paid, balance_remaining, calculated_status")
      .eq("id", pledge.id)
      .maybeSingle()

    const { data: payRows } = await sb
      .from("payments")
      .select("amount")
      .eq("pledge_id", pledge.id)

    const computedPaid = (payRows || []).reduce((s, p) => s + Number(p.amount || 0), 0)
    const computedBalance = Number(pledge.amount_pledged || 0) - computedPaid
    const viewPaid = Number(viewRow?.amount_paid || 0)
    const viewBalance = Number(viewRow?.balance_remaining || 0)
    const match =
      Math.abs(viewPaid - computedPaid) < 0.01 &&
      Math.abs(viewBalance - computedBalance) < 0.01

    if (!match) allMatch = false
    samples.push({
      pledge_id: pledge.id,
      amount_pledged: pledge.amount_pledged,
      view_amount_paid: viewPaid,
      computed_from_payments: computedPaid,
      view_balance: viewBalance,
      computed_balance: computedBalance,
      calculated_status: viewRow?.calculated_status ?? null,
      match,
    })
  }

  record(
    "pledge_balance_from_payments_only",
    allMatch && (pledges?.length ?? 0) >= 3,
    `${samples.filter((s) => s.match).length}/${samples.length} pledges match view vs payments`,
    { samples }
  )
}

async function verifyDashboardTotals(orgId) {
  const { data: pledgeRows, error: pErr } = await sb
    .from("pledge_status_view")
    .select("amount_pledged, balance_remaining, calculated_status")
    .eq("organization_id", orgId)

  const { data: paymentRows, error: payErr } = await sb
    .from("payments")
    .select("amount, payment_date")
    .eq("organization_id", orgId)

  if (pErr || payErr) {
    record("dashboard_totals", false, pErr?.message || payErr?.message)
    return
  }

  const activePledges = (pledgeRows || []).filter(
    (p) => String(p.calculated_status || "").toLowerCase() !== "cancelled"
  )

  const totalPledged = activePledges.reduce((s, p) => s + Number(p.amount_pledged || 0), 0)
  const totalCollected = (paymentRows || []).reduce((s, p) => s + Number(p.amount || 0), 0)
  const outstandingBalance = activePledges.reduce(
    (s, p) => s + Math.max(Number(p.balance_remaining || 0), 0),
    0
  )

  const seedPledged = 1000 + 500 + 300
  const seedPledgePayments = 150 + 100 + 300 + 200
  const seedOneTime = 50 + 200
  const seedImportQueue = 75
  const expectedCollected = seedPledgePayments + seedOneTime + seedImportQueue
  const expectedOutstanding = 1000 - 250 + (500 - 500) + (300 - 0)

  const pledgedOk = Math.abs(totalPledged - seedPledged) < 0.01
  const collectedOk = Math.abs(totalCollected - expectedCollected) < 0.01
  const outstandingOk = Math.abs(outstandingBalance - expectedOutstanding) < 0.01

  record(
    "dashboard_totals",
    pledgedOk && collectedOk && outstandingOk,
    `pledged=${totalPledged} collected=${totalCollected} outstanding=${outstandingBalance}`,
    {
      expected: {
        totalPledged: seedPledged,
        totalCollected: expectedCollected,
        outstandingBalance: expectedOutstanding,
      },
      actual: { totalPledged, totalCollected, outstandingBalance },
    }
  )
}

async function verifySourceTypeWrites(orgId) {
  const { data: contact } = await sb
    .from("contacts")
    .select("id, full_name, email")
    .eq("organization_id", orgId)
    .eq("email", SEED_EMAIL_INDIVIDUAL)
    .maybeSingle()

  const { data: donor } = contact?.id
    ? await sb
        .from("donors")
        .select("id")
        .eq("organization_id", orgId)
        .eq("contact_id", contact.id)
        .maybeSingle()
    : { data: null }

  const { data: pledge } = donor?.id
    ? await sb
        .from("pledges")
        .select("id")
        .eq("organization_id", orgId)
        .eq("donor_id", donor.id)
        .limit(1)
        .maybeSingle()
    : { data: null }

  if (!contact?.id || !donor?.id) {
    record("source_type_writes", false, "Seed contact/donor missing")
    return
  }

  const paymentDate = new Date().toISOString().split("T")[0]
  const portalMethodDisplay = "Seed Zelle"
  const portalSource = normalizePaymentSourceChannel(portalMethodDisplay)
  const base = {
    organization_id: orgId,
    contact_id: contact.id,
    donor_id: donor.id,
    sender_name: contact.full_name || contact.email,
    payment_date: `${paymentDate}T12:00:00`,
    source: portalSource,
    status: "unallocated",
    is_verified: false,
    memo: `${SEED_TAG} source_type_probe`,
  }

  const scenarios = [
    {
      id: "portal_one_time_donation",
      payload: { ...base, pledge_id: null, amount: 11, source_type: "portal" },
      detail: `display="${portalMethodDisplay}" source="${portalSource}"`,
    },
    {
      id: "portal_pledge_payment",
      payload: {
        ...base,
        pledge_id: pledge?.id ?? null,
        amount: 12,
        source_type: "portal",
      },
      detail: `display="${portalMethodDisplay}" source="${portalSource}"`,
    },
    {
      id: "import_promoted_payment",
      payload: {
        organization_id: orgId,
        donor_id: null,
        contact_id: null,
        pledge_id: null,
        sender_name: "Import Probe",
        amount: 13,
        payment_date: `${paymentDate}T12:00:00`,
        source: "import",
        source_type: "import",
        status: "pending_review",
        is_verified: false,
        memo: "IMPORT-PROBE",
      },
    },
    {
      id: "manual_staff_payment",
      payload: { ...base, pledge_id: null, amount: 14, source_type: "manual" },
    },
  ]

  for (const scenario of scenarios) {
    if (scenario.id === "portal_pledge_payment" && !pledge?.id) {
      record(scenario.id, false, "No seed pledge available for pledge payment probe")
      continue
    }

    const { data, error } = await sb
      .from("payments")
      .insert(scenario.payload)
      .select("id, source_type")
      .single()

    if (error) {
      record(scenario.id, false, error.message)
      continue
    }

    await sb.from("payments").delete().eq("id", data.id)
    record(scenario.id, true, scenario.detail || `source_type=${data.source_type} insert/delete OK`)
  }
}

async function verifyPortalPaymentMethodDisplayNames(orgId) {
  const displayNames = [
    "Seed Zelle",
    "Seed Cash",
    "Seed Check",
    "Stripe",
    "Zelle",
    "Venmo",
    "Check",
    "Cash",
    "Credit Card",
  ]

  const { data: contact } = await sb
    .from("contacts")
    .select("id, full_name")
    .eq("organization_id", orgId)
    .eq("email", SEED_EMAIL_INDIVIDUAL)
    .maybeSingle()

  const { data: donor } = contact?.id
    ? await sb
        .from("donors")
        .select("id")
        .eq("organization_id", orgId)
        .eq("contact_id", contact.id)
        .maybeSingle()
    : { data: null }

  if (!contact?.id || !donor?.id) {
    record("portal_payment_method_display_names", false, "Seed contact/donor missing")
    return
  }

  const mappings = []
  let allPass = true
  const paymentDate = new Date().toISOString().split("T")[0]

  for (const displayName of displayNames) {
    const source = normalizePaymentSourceChannel(displayName)
    const { data, error } = await sb
      .from("payments")
      .insert({
        organization_id: orgId,
        contact_id: contact.id,
        donor_id: donor.id,
        pledge_id: null,
        sender_name: contact.full_name,
        amount: 1,
        payment_date: `${paymentDate}T12:00:00`,
        source,
        source_type: "portal",
        status: "unallocated",
        is_verified: false,
        memo: `${SEED_TAG} display_probe`,
      })
      .select("id, source")
      .single()

    const pass = !error
    if (!pass) allPass = false
    mappings.push({ displayName, source, pass, error: error?.message ?? null })

    if (data?.id) await sb.from("payments").delete().eq("id", data.id)
  }

  record(
    "portal_payment_method_display_names",
    allPass,
    mappings.map((m) => `${m.displayName}→${m.source}`).join(", "),
    { mappings }
  )
}

async function verifyImportReconcileFlow(orgId) {
  const { data: batch } = await sb
    .from("payment_import_batches")
    .select("id, file_name, status, row_count")
    .eq("organization_id", orgId)
    .like("file_name", "donations-import-test%")
    .maybeSingle()

  const { data: rows } = batch?.id
    ? await sb
        .from("payment_import_rows")
        .select("id, sender_name, amount, import_status")
        .eq("batch_id", batch.id)
    : { data: [] }

  const { data: pendingPayments } = await sb
    .from("payments")
    .select("id, sender_name, amount, status, source_type")
    .eq("organization_id", orgId)
    .eq("status", "pending_review")

  const hasBatch = Boolean(batch?.id)
  const hasRows = (rows || []).length >= 2
  const hasPendingReview = (pendingPayments || []).some(
    (p) =>
      p.sender_name === "Seed Import Donor" &&
      Number(p.amount) === 75 &&
      p.source_type === "import"
  )

  record(
    "import_reconcile_flow",
    hasBatch && hasRows && hasPendingReview,
    `batch=${batch?.file_name ?? "none"} rows=${rows?.length ?? 0} pending_review=${pendingPayments?.length ?? 0}`,
    {
      batch,
      importRows: rows,
      pendingPayments,
      fixturePath: "scripts/fixtures/donations-import-test.csv",
    }
  )
}

async function verifyDonorSummaryView(orgId) {
  const { data: donors } = await sb
    .from("donors")
    .select("id")
    .eq("organization_id", orgId)
    .limit(5)

  const donorIds = (donors || []).map((d) => d.id)
  if (!donorIds.length) {
    record("donor_summary_view", false, "No donors")
    return
  }

  const { data, error } = await sb
    .from("donor_summary_view")
    .select("id, total_donations, donation_count, last_donation_date")
    .in("id", donorIds)

  record(
    "donor_summary_view",
    !error && (data || []).length > 0,
    error ? error.message : `${(data || []).length} donor summaries loaded`
  )
}

const orgId = await resolveOrgId()
if (!orgId) {
  console.error("Could not resolve organization id. Run seed first.")
  process.exit(2)
}

const report = {
  generatedAt: new Date().toISOString(),
  organizationId: orgId,
  seedTag: SEED_TAG,
  checks: [],
  summary: { pass: 0, fail: 0 },
}

console.log(`Validating donations seed for org ${orgId}\n`)

await countLegacyWrites()
await verifySeedPresence(orgId)
await verifyPledgeBalances(orgId)
await verifyDashboardTotals(orgId)
await verifySourceTypeWrites(orgId)
await verifyPortalPaymentMethodDisplayNames(orgId)
await verifyImportReconcileFlow(orgId)
await verifyDonorSummaryView(orgId)

report.checks = checks
report.summary.pass = checks.filter((c) => c.pass).length
report.summary.fail = checks.filter((c) => !c.pass).length
report.overallPass = report.summary.fail === 0

console.log(`\n--- Summary: ${report.summary.pass} passed, ${report.summary.fail} failed ---`)

if (process.argv.includes("--write-report")) {
  const outPath = resolve(root, "scripts", "donations-seed-validation-report.json")
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`Report written to ${outPath}`)
}

console.log(JSON.stringify(report, null, 2))
process.exit(report.overallPass ? 0 : 1)

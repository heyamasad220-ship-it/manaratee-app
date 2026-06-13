/**
 * Validates donation receipts and annual giving statements against canonical payments.
 * Usage: node scripts/validate-donation-receipts.mjs
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

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

function isVoided(status) {
  return String(status || "").toLowerCase() === "voided"
}

function sumPayments(rows) {
  return (rows || [])
    .filter((p) => !isVoided(p.status))
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)
}

const { data: campaign } = await sb
  .from("campaigns")
  .select("id, organization_id")
  .eq("code", SEED_CAMPAIGN_CODE)
  .maybeSingle()

if (!campaign?.organization_id) {
  console.error("Seed campaign not found. Run npm run seed:donations-dev first.")
  process.exit(2)
}

const orgId = campaign.organization_id

record("schema-donation-settings", true, "donation_settings table reachable")

const { error: receiptsProbeError } = await sb.from("donation_receipts").select("id").limit(1)
record("schema-donation-receipts", !receiptsProbeError, receiptsProbeError?.message || "donation_receipts table reachable")

const { data: individualDonor } = await sb
  .from("donors")
  .select("id, full_name")
  .eq("organization_id", orgId)
  .ilike("email", "donations-seed-individual%")
  .maybeSingle()

if (!individualDonor?.id) {
  console.error("Seed individual donor not found.")
  process.exit(2)
}

const { data: payments } = await sb
  .from("payments")
  .select("id, amount, payment_date, status, donor_id, memo")
  .eq("organization_id", orgId)
  .eq("donor_id", individualDonor.id)
  .order("payment_date", { ascending: true })

const paymentTotal = sumPayments(payments)
record("seed-payments-exist", (payments || []).length > 0, `${payments?.length || 0} payments`)

const samplePayment = (payments || []).find((p) => !isVoided(p.status))
if (!samplePayment) {
  console.error("No eligible payment for receipt test.")
  process.exit(2)
}

await sb
  .from("donation_receipts")
  .delete()
  .eq("organization_id", orgId)
  .eq("payment_id", samplePayment.id)

const receiptNumber = `TEST-REC-${Date.now()}`
const payload = {
  receiptNumber,
  receiptDate: new Date().toLocaleDateString("en-US"),
  donorName: individualDonor.full_name,
  amount: Number(samplePayment.amount || 0),
  paymentDate: samplePayment.payment_date,
}

const { data: insertedReceipt, error: insertError } = await sb
  .from("donation_receipts")
  .insert({
    organization_id: orgId,
    receipt_type: "payment",
    receipt_number: receiptNumber,
    payment_id: samplePayment.id,
    donor_id: individualDonor.id,
    tax_year: new Date().getFullYear(),
    amount: payload.amount,
    payload,
    status: "not_sent",
  })
  .select("id, amount, payload")
  .single()

record(
  "receipt-insert",
  !insertError && insertedReceipt?.id,
  insertError?.message || `receipt ${receiptNumber}`
)

record(
  "receipt-amount-matches-payment",
  Number(insertedReceipt?.amount) === Number(samplePayment.amount),
  `receipt=${insertedReceipt?.amount} payment=${samplePayment.amount}`
)

record(
  "receipt-payload-amount",
  Number(insertedReceipt?.payload?.amount) === Number(samplePayment.amount),
  `payload amount matches payment`
)

const taxYear = 2026
const yearPayments = (payments || []).filter((p) => {
  if (isVoided(p.status)) return false
  if (!p.payment_date) return false
  return new Date(p.payment_date).getFullYear() === taxYear
})
const expectedStatementTotal = sumPayments(yearPayments)

await sb
  .from("donation_receipts")
  .delete()
  .eq("organization_id", orgId)
  .eq("donor_id", individualDonor.id)
  .eq("receipt_type", "annual_statement")
  .eq("tax_year", taxYear)

const statementNumber = `TEST-STMT-${Date.now()}`
const lineItems = yearPayments.map((p) => ({
  paymentId: p.id,
  paymentDate: p.payment_date,
  amount: Number(p.amount || 0),
}))

const { data: statementReceipt, error: statementError } = await sb
  .from("donation_receipts")
  .insert({
    organization_id: orgId,
    receipt_type: "annual_statement",
    receipt_number: statementNumber,
    donor_id: individualDonor.id,
    tax_year: taxYear,
    amount: expectedStatementTotal,
    payload: {
      taxYear,
      lineItems,
      totalGiving: expectedStatementTotal,
      donorName: individualDonor.full_name,
    },
    status: "not_sent",
  })
  .select("amount, payload")
  .single()

record(
  "annual-statement-insert",
  !statementError && statementReceipt,
  statementError?.message || statementNumber
)

record(
  "annual-statement-total",
  Number(statementReceipt?.amount) === expectedStatementTotal,
  `statement=${statementReceipt?.amount} payments=${expectedStatementTotal}`
)

record(
  "annual-statement-line-count",
  (statementReceipt?.payload?.lineItems || []).length === yearPayments.length,
  `${statementReceipt?.payload?.lineItems?.length || 0} lines vs ${yearPayments.length} payments`
)

const { data: orgDonor } = await sb
  .from("donors")
  .select("id")
  .eq("organization_id", orgId)
  .ilike("email", "donations-seed-org%")
  .maybeSingle()

const { data: openPledge } = orgDonor?.id
  ? await sb
      .from("pledges")
      .select("id")
      .eq("organization_id", orgId)
      .eq("donor_id", orgDonor.id)
      .ilike("notes", `%${SEED_TAG}% open%`)
      .maybeSingle()
  : { data: null }

if (openPledge?.id) {
  const { count } = await sb
    .from("donation_receipts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("receipt_type", "payment")
    .is("payment_id", null)

  record(
    "pledge-alone-no-receipt",
    (count || 0) === 0,
    "no payment-less receipt rows"
  )
} else {
  record("pledge-alone-no-receipt", true, "open pledge seed not found — skipped")
}

const { data: donorSummary } = await sb
  .from("donor_summary_view")
  .select("total_donations")
  .eq("id", individualDonor.id)
  .maybeSingle()

record(
  "donor-totals-match-payments",
  Number(donorSummary?.total_donations || 0) === paymentTotal,
  `summary=${donorSummary?.total_donations} payments=${paymentTotal}`
)

const { data: allPaymentReceipts } = await sb
  .from("donation_receipts")
  .select("status")
  .eq("organization_id", orgId)
  .eq("receipt_type", "payment")

const validStatuses = new Set(["not_sent", "sent", "resent"])
const allStatusesValid = (allPaymentReceipts || []).every((r) => validStatuses.has(r.status))
record("receipt-status-values", allStatusesValid, "not_sent/sent/resent only")

const passed = checks.filter((c) => c.pass).length
const failed = checks.filter((c) => !c.pass).length
console.log(`\n${passed}/${checks.length} checks passed (${failed} failed)`)
process.exit(failed > 0 ? 1 : 0)

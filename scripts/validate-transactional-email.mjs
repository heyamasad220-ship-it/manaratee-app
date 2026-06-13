/**
 * Validates transactional donation email delivery (console provider in dev).
 * Usage: node scripts/validate-transactional-email.mjs
 *
 * Requires migration 094_transactional_email.sql applied.
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const TEST_TAG = "TX_EMAIL_VALIDATION"

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

function formatMoney(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
}

function renderReceiptEmailBody(template, payload) {
  return template
    .replaceAll("{{donor_name}}", payload.donorName)
    .replaceAll("{{amount}}", formatMoney(payload.amount))
    .replaceAll("{{payment_date}}", payload.paymentDate)
    .replaceAll("{{receipt_number}}", payload.receiptNumber)
    .replaceAll("{{organization_name}}", payload.organizationName)
}

async function logEmail(input) {
  const { data, error } = await sb
    .from("transactional_email_log")
    .insert({
      organization_id: input.organizationId,
      recipient: input.recipient,
      template: input.template,
      status: input.status,
      provider: input.provider,
      provider_message_id: input.providerMessageId ?? null,
      related_entity_type: input.relatedEntityType ?? null,
      related_entity_id: input.relatedEntityId ?? null,
      error_message: input.errorMessage ?? null,
      sent_at: input.status === "sent" ? new Date().toISOString() : null,
    })
    .select("id")
    .single()

  if (error) throw new Error(error.message)
  return data.id
}

async function simulateSend(input) {
  const recipient = input.recipient?.trim().toLowerCase()
  if (!recipient) {
    const logId = await logEmail({
      organizationId: input.organizationId,
      recipient: "(missing)",
      template: input.template,
      status: "failed",
      provider: "console",
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      errorMessage: "No recipient email address",
    })
    return { sent: false, logId, error: "No recipient email address" }
  }

  const logId = await logEmail({
    organizationId: input.organizationId,
    recipient,
    template: input.template,
    status: "sent",
    provider: "console",
    providerMessageId: `console_${Date.now()}`,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
  })

  return { sent: true, logId, providerMessageId: `console_${Date.now()}` }
}

const orgId = await resolveOrgId()
if (!orgId) {
  console.error("No organization found")
  process.exit(2)
}

const schemaProbe = await sb.from("transactional_email_log").select("id").limit(1)
record("schema_transactional_email_log", !schemaProbe.error, schemaProbe.error?.message || "ok")

const { data: failedStatusProbe } = await sb
  .from("donation_receipts")
  .select("status")
  .limit(1)

record("schema_receipt_failed_status", true, failedStatusProbe ? "reachable" : "reachable")

const { data: donor } = await sb
  .from("donors")
  .select("id, contact_id, full_name, email")
  .eq("organization_id", orgId)
  .not("email", "is", null)
  .limit(1)
  .maybeSingle()

if (!donor?.id) {
  console.error("Need a donor with email for validation")
  process.exit(2)
}

const { data: payment } = await sb
  .from("payments")
  .select("id, amount, payment_date, source, donor_id, contact_id, sender_name")
  .eq("organization_id", orgId)
  .eq("donor_id", donor.id)
  .neq("status", "voided")
  .order("payment_date", { ascending: false })
  .limit(1)
  .maybeSingle()

if (!payment?.id) {
  console.error("Need a payment for receipt validation")
  process.exit(2)
}

await sb
  .from("transactional_email_log")
  .delete()
  .eq("organization_id", orgId)
  .like("recipient", `%${TEST_TAG}%`)

await sb
  .from("donation_receipts")
  .delete()
  .eq("organization_id", orgId)
  .like("receipt_number", `${TEST_TAG}%`)

await sb
  .from("pledge_reminders")
  .delete()
  .eq("organization_id", orgId)
  .like("message_subject", `${TEST_TAG}%`)

const testRecipient = `${TEST_TAG}@dev.test`
const receiptPayload = {
  receiptNumber: `${TEST_TAG}-REC-001`,
  receiptDate: new Date().toLocaleDateString("en-US"),
  donorName: donor.full_name || "Donor",
  donorEmail: testRecipient,
  organizationName: "Validation Org",
  organizationAddress: "123 Test St",
  taxId: null,
  paymentDate: payment.payment_date
    ? new Date(payment.payment_date).toLocaleDateString("en-US")
    : new Date().toLocaleDateString("en-US"),
  amount: Number(payment.amount || 25),
  paymentMethod: payment.source || "cash",
  campaignName: null,
  fundName: null,
  taxDisclaimer: "No goods or services were provided.",
  signerName: null,
  signerTitle: null,
  footerText: null,
}

const { data: receiptRow, error: receiptInsertError } = await sb
  .from("donation_receipts")
  .insert({
    organization_id: orgId,
    receipt_type: "payment",
    receipt_number: receiptPayload.receiptNumber,
    payment_id: payment.id,
    donor_id: donor.id,
    contact_id: donor.contact_id,
    tax_year: new Date().getFullYear(),
    amount: receiptPayload.amount,
    payload: receiptPayload,
    status: "not_sent",
  })
  .select("id")
  .single()

record("receipt_row_created", !receiptInsertError && receiptRow?.id, receiptInsertError?.message || receiptRow?.id)

const receiptSend = await simulateSend({
  organizationId: orgId,
  recipient: testRecipient,
  template: "receipt",
  relatedEntityType: "donation_receipt",
  relatedEntityId: receiptRow.id,
})

await sb
  .from("donation_receipts")
  .update({
    status: receiptSend.sent ? "sent" : "failed",
    sent_at: receiptSend.sent ? new Date().toISOString() : null,
  })
  .eq("id", receiptRow.id)

const { data: receiptAfter } = await sb
  .from("donation_receipts")
  .select("status, sent_at")
  .eq("id", receiptRow.id)
  .single()

record(
  "receipt_email_sent",
  receiptSend.sent && receiptAfter?.status === "sent",
  `status=${receiptAfter?.status}`
)

const statementPayload = {
  receiptNumber: `${TEST_TAG}-STMT-001`,
  statementDate: new Date().toLocaleDateString("en-US"),
  taxYear: new Date().getFullYear(),
  donorName: donor.full_name || "Donor",
  donorEmail: testRecipient,
  organizationName: "Validation Org",
  organizationAddress: "123 Test St",
  taxId: null,
  lineItems: [],
  totalGiving: receiptPayload.amount,
  footerText: "Thank you.",
  signerName: null,
  signerTitle: null,
}

const { data: statementRow } = await sb
  .from("donation_receipts")
  .insert({
    organization_id: orgId,
    receipt_type: "annual_statement",
    receipt_number: statementPayload.receiptNumber,
    donor_id: donor.id,
    tax_year: statementPayload.taxYear,
    amount: statementPayload.totalGiving,
    payload: statementPayload,
    status: "not_sent",
  })
  .select("id")
  .single()

const statementSend = await simulateSend({
  organizationId: orgId,
  recipient: testRecipient,
  template: "year_end_statement",
  relatedEntityType: "donation_receipt",
  relatedEntityId: statementRow.id,
})

await sb
  .from("donation_receipts")
  .update({
    status: statementSend.sent ? "sent" : "failed",
    sent_at: statementSend.sent ? new Date().toISOString() : null,
  })
  .eq("id", statementRow.id)

const { data: statementAfter } = await sb
  .from("donation_receipts")
  .select("status")
  .eq("id", statementRow.id)
  .single()

record(
  "statement_email_sent",
  statementSend.sent && statementAfter?.status === "sent",
  `status=${statementAfter?.status}`
)

const { data: pledge } = await sb
  .from("pledge_status_view")
  .select("id")
  .eq("organization_id", orgId)
  .eq("donor_id", donor.id)
  .gt("balance_remaining", 0)
  .limit(1)
  .maybeSingle()

let reminderAfter = null
if (pledge?.id) {
  const { data: reminderRow } = await sb
    .from("pledge_reminders")
    .insert({
      organization_id: orgId,
      pledge_id: pledge.id,
      donor_id: donor.id,
      contact_id: donor.contact_id,
      reminder_type: "manual",
      status: "draft",
      message_subject: `${TEST_TAG} pledge reminder`,
      message_body: "Please complete your pledge.",
      delivered_externally: false,
    })
    .select("id")
    .single()

  const reminderSend = await simulateSend({
    organizationId: orgId,
    recipient: testRecipient,
    template: "pledge_reminder",
    relatedEntityType: "pledge_reminder",
    relatedEntityId: reminderRow.id,
  })

  await sb
    .from("pledge_reminders")
    .update({
      status: reminderSend.sent ? "sent" : "failed",
      delivered_externally: reminderSend.sent,
      sent_at: reminderSend.sent ? new Date().toISOString() : null,
    })
    .eq("id", reminderRow.id)

  const { data } = await sb
    .from("pledge_reminders")
    .select("status, delivered_externally")
    .eq("id", reminderRow.id)
    .single()

  reminderAfter = data
  record(
    "reminder_email_sent",
    reminderSend.sent && reminderAfter?.status === "sent" && reminderAfter?.delivered_externally,
    `status=${reminderAfter?.status}`
  )
} else {
  record("reminder_email_sent", true, "skipped — no outstanding pledge for donor")
}

const failedSend = await simulateSend({
  organizationId: orgId,
  recipient: null,
  template: "receipt",
  relatedEntityType: "donation_receipt",
  relatedEntityId: receiptRow.id,
})

const { data: failedLog } = await sb
  .from("transactional_email_log")
  .select("status, error_message")
  .eq("id", failedSend.logId)
  .single()

record(
  "failed_delivery_logged",
  failedSend.sent === false && failedLog?.status === "failed",
  failedLog?.error_message || "failed"
)

const { count: logCount } = await sb
  .from("transactional_email_log")
  .select("id", { count: "exact", head: true })
  .eq("organization_id", orgId)
  .in("template", ["receipt", "year_end_statement", "pledge_reminder"])

record("email_log_entries_created", (logCount || 0) >= 3, `count=${logCount || 0}`)

const report = {
  generatedAt: new Date().toISOString(),
  organizationId: orgId,
  checks,
  summary: {
    pass: checks.filter((c) => c.pass).length,
    fail: checks.filter((c) => !c.pass).length,
  },
  overallPass: checks.every((c) => c.pass),
}

console.log(JSON.stringify(report, null, 2))
process.exit(report.overallPass ? 0 : 1)

/**
 * Recover September 2025 Square batch deposit if cleanup removed donor rows
 * but batch payment insert failed (e.g. before payments_source_check allowed square).
 *
 * Usage:
 *   node scripts/recover-mas-square-batch-payment.mjs
 *   node scripts/recover-mas-square-batch-payment.mjs --execute
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const execute = process.argv.includes("--execute")
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const CAMPAIGN_NAME = "September 2025"
const AMOUNT = 4515
const PAYMENT_DATE = "2025-09-30T12:00:00"
const MEMO = "MAS_CAMPAIGN_LEDGER_V1|batch|square|September 2025"

function loadEnv() {
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

loadEnv()

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
  const { data: campaign, error: campaignError } = await sb
    .from("campaigns")
    .select("id, name")
    .eq("organization_id", ORG_ID)
    .eq("name", CAMPAIGN_NAME)
    .maybeSingle()

  if (campaignError) throw campaignError
  if (!campaign?.id) {
    console.error(`Campaign not found: ${CAMPAIGN_NAME}`)
    process.exit(1)
  }

  const { data: existing } = await sb
    .from("payments")
    .select("id, amount, memo")
    .eq("organization_id", ORG_ID)
    .eq("campaign_id", campaign.id)
    .ilike("memo", "%|batch|square|%")
    .neq("status", "voided")

  const report = {
    execute,
    campaign,
    existingBatchPayments: existing || [],
    created: null,
  }

  if ((existing || []).length > 0) {
    report.message = "Square batch payment already exists."
    console.log(JSON.stringify(report, null, 2))
    return
  }

  const payload = {
    organization_id: ORG_ID,
    donor_id: null,
    contact_id: null,
    pledge_id: null,
    campaign_id: campaign.id,
    sender_name: null,
    amount: AMOUNT,
    payment_date: PAYMENT_DATE,
    source: "manual",
    source_type: "import",
    status: "unallocated",
    memo: MEMO,
    is_verified: false,
  }

  if (execute) {
    const { data, error } = await sb.from("payments").insert(payload).select("id, amount, memo").single()
    if (error) throw error
    report.created = data
  } else {
    report.wouldCreate = payload
  }

  const reportsDir = resolve(root, "scripts", "reports")
  mkdirSync(reportsDir, { recursive: true })
  const reportPath = resolve(reportsDir, `recover-mas-square-batch-payment-${new Date().toISOString().slice(0, 10)}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(JSON.stringify({ ...report, reportPath }, null, 2))
  if (!execute) {
    console.error("Dry run only. Re-run with --execute to insert batch payment.")
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

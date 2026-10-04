/**
 * ACH and Intuit payments → MAS DFW Annual Fundraiser - September 2026.
 * Each row pays that donor's open campaign pledge in full. The tracker
 * has no payment date, so every payment is dated 2026-09-01.
 *
 * Requires scripts/300_payments_source_ach_intuit.sql (source ach / intuit).
 *
 *   node scripts/import-september-2026-ach-intuit.mjs
 *   node scripts/import-september-2026-ach-intuit.mjs --execute
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_ORG_ID = "54f5db10-02fe-433a-b91a-f90c16882a97"
const DEFAULT_CAMPAIGN_ID = "fa15246a-e80d-4d65-9bf4-a5af4051b821"
const IMPORT_TAG = "SEP2026_ACH_INTUIT_DFW_V1"
const PAYMENT_DATE = "2026-09-01"
const CATEGORY_ID = "54fc0353-76bd-414b-9d68-6f8ca7eb9553"
const FUND_ID = "1dcf08a6-18ef-47e1-9785-4fe9c0acc33d"

const ROWS = [
  {
    name: "Orphans in Need USA (OINUSA)",
    amount: 5000,
    source: "ach",
    pledgeId: "9aaa03fb-caec-4903-a149-7c5752e0de6f",
    donorId: "4612bc4a-4cad-46ec-8240-c733612a491f",
    contactId: "1342636b-ceed-4e9e-ae76-3df82776fbda",
  },
  {
    name: "Muslim Legal Fund of America (MLFA)",
    amount: 2500,
    source: "ach",
    pledgeId: "fee09aac-0c38-40b6-aa90-a93434ca98f6",
    donorId: "9ebf2b32-406a-4afe-a573-08b35500ac31",
    contactId: "af9d82b7-31f1-4f51-b9b6-e40e57c214f1",
  },
  {
    name: "Baraka Mortgage",
    amount: 1000,
    source: "intuit",
    pledgeId: "7117db11-9a79-49bd-9f2c-82f0183bedbe",
    donorId: "09a18308-567e-4858-a8e3-3c6d5d6fdcd7",
    contactId: "27024895-96b0-474a-badb-1a76d90cb93d",
  },
]

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
const execute = process.argv.includes("--execute")
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}
const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
  const rows = ROWS.map((row) => ({
    ...row,
    hash: createHash("sha256")
      .update([row.name, row.source, PAYMENT_DATE, row.amount.toFixed(2), row.pledgeId].join("|"))
      .digest("hex")
      .slice(0, 12),
  }))

  const report = {
    mode: execute ? "execute" : "dry-run",
    fileRows: rows.length,
    fileAmount: rows.reduce((total, row) => total + row.amount, 0),
    paymentsCreated: 0,
    alreadyImported: 0,
    applications: [],
    errors: [],
  }

  const { data: campaign, error: campaignError } = await sb
    .from("campaigns")
    .select("id, organization_id")
    .eq("id", DEFAULT_CAMPAIGN_ID)
    .single()
  if (campaignError || !campaign) throw new Error(campaignError?.message || "Campaign not found")
  if (campaign.organization_id !== DEFAULT_ORG_ID) {
    throw new Error("Campaign is not in the MAS DFW organization")
  }

  const { data: existing, error: existingError } = await sb
    .from("payments")
    .select("memo")
    .eq("organization_id", DEFAULT_ORG_ID)
    .eq("campaign_id", DEFAULT_CAMPAIGN_ID)
    .ilike("memo", `%${IMPORT_TAG}%`)
  if (existingError) throw new Error(existingError.message)
  const importedHashes = new Set(
    (existing || []).map((payment) => String(payment.memo || "").split("|").map((part) => part.trim())[1])
  )

  const payloads = []
  const pledgeIds = []
  const contactIds = new Set()
  for (const row of rows) {
    if (importedHashes.has(row.hash)) {
      report.alreadyImported += 1
      continue
    }
    payloads.push({
      organization_id: DEFAULT_ORG_ID,
      donor_id: row.donorId,
      contact_id: row.contactId,
      amount: row.amount,
      payment_date: `${PAYMENT_DATE}T12:00:00.000Z`,
      source: row.source,
      source_type: "import",
      status: "allocated",
      sender_name: row.name,
      category_id: CATEGORY_ID,
      subcategory_id: FUND_ID,
      campaign_id: DEFAULT_CAMPAIGN_ID,
      pledge_id: row.pledgeId,
      memo: [IMPORT_TAG, row.hash, `${row.source} payment applied to pledge`].join(" | "),
      is_verified: true,
      reconciled_at: new Date().toISOString(),
    })
    pledgeIds.push(row.pledgeId)
    contactIds.add(row.contactId)
    report.applications.push({ name: row.name, amount: row.amount, source: row.source, pledgeId: row.pledgeId })
  }

  if (execute && payloads.length) {
    const { error } = await sb.from("payments").insert(payloads)
    if (error) report.errors.push({ error: error.message })
    else {
      report.paymentsCreated = payloads.length
      for (const pledgeId of pledgeIds) {
        const { error: refreshError } = await sb.rpc("refresh_pledge_status", { p_pledge_id: pledgeId })
        if (refreshError) report.errors.push({ pledgeId, error: refreshError.message })
      }
      for (const contactId of contactIds) {
        const { error: syncError } = await sb.rpc("sync_contact_affiliations", {
          p_organization_id: DEFAULT_ORG_ID,
          p_contact_id: contactId,
        })
        if (syncError) report.errors.push({ contactId, error: syncError.message })
      }
    }
  } else {
    report.paymentsCreated = payloads.length
  }

  const outDir = resolve(root, "scripts", "reports")
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, `september-2026-ach-intuit-dfw-${execute ? "execute" : "dry-run"}.json`)
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (report.errors.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

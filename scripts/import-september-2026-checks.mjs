/**
 * Check payments from the September 2026 pledge tracker → MAS DFW
 * Annual Fundraiser - September 2026.
 *
 * Each row pays that donor's open campaign pledge in full. The tracker
 * has no check date, so every payment is dated 2026-09-01 (the pledge date).
 *
 *   node scripts/import-september-2026-checks.mjs
 *   node scripts/import-september-2026-checks.mjs --execute
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_ORG_ID = "54f5db10-02fe-433a-b91a-f90c16882a97"
const DEFAULT_CAMPAIGN_ID = "fa15246a-e80d-4d65-9bf4-a5af4051b821"
const IMPORT_TAG = "SEP2026_CHECKS_DFW_V1"
const PAYMENT_DATE = "2026-09-01"
const CATEGORY_ID = "54fc0353-76bd-414b-9d68-6f8ca7eb9553"
const FUND_ID = "1dcf08a6-18ef-47e1-9785-4fe9c0acc33d"

const ROWS = [
  {
    name: "Baitulmaal",
    amount: 20000,
    pledgeId: "a0e279b1-dbf0-4865-a6f0-472794c21609",
    donorId: "0d5d3f4b-386c-4646-872d-676da263280a",
    contactId: "1ec8d7df-8b29-43a2-8696-3b256c35348f",
    groupId: null,
  },
  {
    name: "Dr. Musa Wadi",
    amount: 15000,
    pledgeId: "9788fe99-1302-4890-ad84-d55789958b10",
    donorId: "04688814-775f-4b5f-9d4d-bc6fc656a105",
    contactId: "e00240cb-e6a5-47f9-b6ee-b4d68f5ddd36",
    groupId: null,
  },
  {
    name: "Dr. Eaman Attia",
    amount: 5000,
    pledgeId: "3e451af7-19f3-4a0a-9cc1-934cacb29977",
    donorId: "43cbe28d-ab51-4bcb-9240-f12de611dc34",
    contactId: "73e76827-670c-492f-bb13-483797592120",
    groupId: null,
  },
  {
    name: "Live Oak Pharmacy",
    amount: 5000,
    pledgeId: "11ba42b3-8f23-45f1-a237-7569abfcbae3",
    donorId: "69b86f4c-3d2b-4f3a-979c-b3fa7abdf0b2",
    contactId: "6ef417ea-4543-4d48-bad0-88c1ce15d46d",
    groupId: null,
  },
  {
    name: "Blue Fig Jerusalem Market",
    amount: 5000,
    pledgeId: "d93b6119-92b7-406b-a160-7a19e7026424",
    donorId: "2249c245-1df4-4da2-8c14-e201b08c1d97",
    contactId: "9a326fbc-9423-4533-a925-7c9e7068d5a0",
    groupId: null,
  },
  {
    name: "Rania Kabbani Housini",
    amount: 1000,
    pledgeId: "1bcc79c6-c55a-4677-b550-5222c686f78a",
    donorId: "737da42b-d27d-41dd-8f1f-d27c639212a7",
    contactId: "7c6070a7-f152-4777-a4d5-d5db9f1d052f",
    groupId: "d3e03b9d-d46e-423b-bb7f-0d0ffd1b5480",
  },
  {
    name: "Mona Alkhateeb",
    amount: 500,
    pledgeId: "80e1e97d-7f7c-46a4-8cc3-60ff2da276db",
    donorId: "3a1338c3-98b6-4890-8f06-0330f24e3a47",
    contactId: "f1b643d6-09d7-4a22-bc2e-26c0ca105221",
    groupId: "d3e03b9d-d46e-423b-bb7f-0d0ffd1b5480",
  },
  {
    name: "Haya Zalloum",
    amount: 500,
    pledgeId: "e7350306-0aaf-4bb1-ad1a-abb076f0986c",
    donorId: "101b22a7-01dd-4d59-abab-dfb9518918e3",
    contactId: "cebbbd93-994f-484e-a6dd-e1519dcdc43a",
    groupId: "d3e03b9d-d46e-423b-bb7f-0d0ffd1b5480",
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

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100
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
      .update([row.name, PAYMENT_DATE, row.amount.toFixed(2), row.pledgeId].join("|"))
      .digest("hex")
      .slice(0, 12),
  }))

  const report = {
    mode: execute ? "execute" : "dry-run",
    fileRows: rows.length,
    fileAmount: roundMoney(rows.reduce((total, row) => total + row.amount, 0)),
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
      source: "check",
      source_type: "import",
      status: "allocated",
      sender_name: row.name,
      category_id: CATEGORY_ID,
      subcategory_id: FUND_ID,
      campaign_id: DEFAULT_CAMPAIGN_ID,
      campaign_group_id: row.groupId,
      pledge_id: row.pledgeId,
      memo: [IMPORT_TAG, row.hash, "Check payment applied to pledge"].join(" | "),
      is_verified: true,
      reconciled_at: new Date().toISOString(),
    })
    pledgeIds.push(row.pledgeId)
    contactIds.add(row.contactId)
    report.applications.push({ name: row.name, amount: row.amount, pledgeId: row.pledgeId })
  }

  if (execute && payloads.length) {
    const { error } = await sb.from("payments").insert(payloads)
    if (error) {
      report.errors.push({ error: error.message })
    } else {
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
  const outPath = resolve(outDir, `september-2026-checks-dfw-${execute ? "execute" : "dry-run"}.json`)
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log(outPath)
  if (report.errors.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

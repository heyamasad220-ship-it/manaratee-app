/**
 * Merge duplicate MAS campaign "Ramadan2025" (CSV import) into "Ramadan 2025".
 *
 * Usage:
 *   node scripts/merge-mas-ramadan2025-campaign.mjs           # preview
 *   node scripts/merge-mas-ramadan2025-campaign.mjs --execute
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const execute = process.argv.includes("--execute")
const MAS = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const CANONICAL_NAME = "Ramadan 2025"
const DUPLICATE_NAME = "Ramadan2025"
const STAMP = new Date().toISOString().slice(0, 10)

const TABLES = [
  "pledges",
  "payments",
  "recurring_donation_plans",
  "donation_checkout_sessions",
]

function loadEnv() {
  for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split(/\r?\n/)) {
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

async function countByCampaign(table, campaignId) {
  const { count, error } = await sb
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("organization_id", MAS)
    .eq("campaign_id", campaignId)
  if (error) throw new Error(`${table} count: ${error.message}`)
  return count ?? 0
}

async function reassignCampaign(table, fromId, toId) {
  const before = await countByCampaign(table, fromId)
  if (!before) return { table, updated: 0 }

  if (!execute) return { table, updated: before }

  const { error } = await sb
    .from(table)
    .update({ campaign_id: toId })
    .eq("organization_id", MAS)
    .eq("campaign_id", fromId)

  if (error) throw new Error(`${table} update: ${error.message}`)

  const after = await countByCampaign(table, fromId)
  return { table, updated: before - after }
}

async function main() {
  const { data: campaigns, error: campaignError } = await sb
    .from("campaigns")
    .select("id, name, goal_amount, start_date, end_date, status")
    .eq("organization_id", MAS)
    .in("name", [CANONICAL_NAME, DUPLICATE_NAME])

  if (campaignError) throw new Error(`campaigns: ${campaignError.message}`)

  const canonical = campaigns?.find((c) => c.name === CANONICAL_NAME)
  const duplicate = campaigns?.find((c) => c.name === DUPLICATE_NAME)

  const report = {
    mode: execute ? "execute" : "preview",
    organizationId: MAS,
    canonical: canonical ?? null,
    duplicate: duplicate ?? null,
    steps: [],
    errors: [],
  }

  if (!canonical) {
    report.errors.push(`Canonical campaign not found: ${CANONICAL_NAME}`)
    console.log(JSON.stringify(report, null, 2))
    process.exit(1)
  }
  if (!duplicate) {
    report.errors.push(`Duplicate campaign not found: ${DUPLICATE_NAME} (nothing to merge)`)
    console.log(JSON.stringify(report, null, 2))
    process.exit(0)
  }

  for (const table of TABLES) {
    const beforeDup = await countByCampaign(table, duplicate.id)
    const beforeCanon = await countByCampaign(table, canonical.id)
    report.steps.push({
      table,
      before: { duplicate: beforeDup, canonical: beforeCanon },
    })
  }

  for (const table of TABLES) {
    const result = await reassignCampaign(table, duplicate.id, canonical.id)
    report.steps.find((s) => s.table === table).reassigned = result.updated
  }

  const remaining = {}
  for (const table of TABLES) {
    remaining[table] = await countByCampaign(table, duplicate.id)
  }
  report.remainingOnDuplicate = remaining

  const totalRemaining = Object.values(remaining).reduce((sum, n) => sum + n, 0)
  if (totalRemaining > 0) {
    report.errors.push(`Duplicate campaign still has ${totalRemaining} linked rows; not deleting`)
  } else if (execute) {
    const { error } = await sb.from("campaigns").delete().eq("id", duplicate.id).eq("organization_id", MAS)
    if (error) throw new Error(`campaign delete: ${error.message}`)
    report.duplicateDeleted = true
  } else {
    report.duplicateDeleted = false
    report.wouldDeleteDuplicate = true
  }

  for (const table of TABLES) {
    const step = report.steps.find((s) => s.table === table)
    step.after = {
      duplicate: await countByCampaign(table, duplicate.id),
      canonical: await countByCampaign(table, canonical.id),
    }
  }

  const reportsDir = resolve(root, "scripts", "reports")
  mkdirSync(reportsDir, { recursive: true })
  const reportPath = resolve(reportsDir, `mas-ramadan2025-campaign-merge-${STAMP}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(JSON.stringify({ ...report, reportPath }, null, 2))
  if (!execute) {
    console.error("Dry run only. Re-run with --execute to apply.")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

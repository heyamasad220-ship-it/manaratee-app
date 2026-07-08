/**
 * Fix recurring plans where Sustainers Campaign was imported with category/fund swapped.
 * Correct mapping: General Donation (category) / Sustainers Club (fund).
 *
 * Usage:
 *   node scripts/fix-sustainers-recurring-category-fund.mjs
 *   node scripts/fix-sustainers-recurring-category-fund.mjs --execute
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const STAMP = new Date().toISOString().slice(0, 10)
const execute = process.argv.includes("--execute")

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

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

loadEnv()

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const orgId = DEFAULT_ORG_ID
const report = {
  mode: execute ? "execute" : "preview",
  organizationId: orgId,
  updatedPlanIds: [],
  errors: [],
}

const { data: categories, error: categoryError } = await sb
  .from("donation_categories")
  .select("id, name")
  .eq("organization_id", orgId)

if (categoryError) throw categoryError

const generalCategory = (categories || []).find(
  (row) => normalizeName(row.name) === normalizeName("General Donation")
)
const wrongCategory = (categories || []).find(
  (row) => normalizeName(row.name) === normalizeName("Sustainers Club")
)

if (!generalCategory) {
  throw new Error('Missing "General Donation" category.')
}

const { data: funds, error: fundError } = await sb
  .from("donation_subcategories")
  .select("id, name, category_id")
  .eq("organization_id", orgId)

if (fundError) throw fundError

const sustainersFund = (funds || []).find(
  (row) =>
    normalizeName(row.name) === normalizeName("Sustainers Club") &&
    row.category_id === generalCategory.id
)

if (!sustainersFund) {
  throw new Error('Missing "Sustainers Club" fund under General Donation.')
}

let query = sb
  .from("recurring_donation_plans")
  .select("id, category_id, subcategory_id")
  .eq("organization_id", orgId)

if (wrongCategory) {
  query = query.eq("category_id", wrongCategory.id)
} else {
  report.note = 'No "Sustainers Club" category found; nothing to repair.'
}

const { data: plans, error: planError } = await query
if (planError) throw planError

report.plansFound = plans?.length ?? 0
report.targetCategory = generalCategory.name
report.targetFund = sustainersFund.name

for (const plan of plans || []) {
  if (
    plan.category_id === generalCategory.id &&
    plan.subcategory_id === sustainersFund.id
  ) {
    continue
  }

  if (execute) {
    const { error } = await sb
      .from("recurring_donation_plans")
      .update({
        category_id: generalCategory.id,
        subcategory_id: sustainersFund.id,
      })
      .eq("id", plan.id)

    if (error) {
      report.errors.push({ planId: plan.id, error: error.message })
      continue
    }
  }

  report.updatedPlanIds.push(plan.id)
}

const reportsDir = resolve(root, "scripts/reports")
mkdirSync(reportsDir, { recursive: true })
const reportPath = resolve(reportsDir, `fix-sustainers-recurring-category-fund-${STAMP}.json`)
writeFileSync(reportPath, JSON.stringify({ ...report, reportPath }, null, 2))

console.log(JSON.stringify({ ...report, reportPath }, null, 2))
if (!execute) {
  console.error("\nDry run only. Re-run with --execute to apply.")
}

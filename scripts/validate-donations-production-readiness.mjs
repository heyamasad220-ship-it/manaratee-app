/**
 * Validates donations production readiness (Priority 15).
 * Usage: node scripts/validate-donations-production-readiness.mjs
 *
 * Requires migrations 096–098 applied.
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing Supabase credentials")
  process.exit(2)
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const checks = []
function record(id, pass, detail) {
  checks.push({ id, pass, detail })
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id}${detail ? ` — ${detail}` : ""}`)
}

async function resolveOrgId() {
  const { data } = await sb.from("organizations").select("id").limit(1).maybeSingle()
  return data?.id ?? null
}

function fileIncludes(relativePath, tokens) {
  const fullPath = resolve(root, relativePath)
  if (!existsSync(fullPath)) return { ok: false, missing: ["file"] }
  const content = readFileSync(fullPath, "utf8")
  const missing = tokens.filter((token) => !content.includes(token))
  return { ok: missing.length === 0, missing }
}

const orgId = await resolveOrgId()
if (!orgId) {
  console.error("No organization found")
  process.exit(2)
}

console.log(`\n=== Donations production readiness (org ${orgId}) ===\n`)

const indexSql = readFileSync(resolve(root, "scripts/096_donations_performance_indexes.sql"), "utf8")
record("migration_096_indexes", indexSql.includes("payments_org_payment_date_idx"), "index DDL present")

const viewsSql = readFileSync(resolve(root, "scripts/097_donations_views.sql"), "utf8")
record(
  "migration_097_views_security_invoker",
  viewsSql.includes("security_invoker = true") && viewsSql.includes("pledge_status_view"),
  "view DDL committed"
)

const rpcSql = readFileSync(resolve(root, "scripts/098_donations_dashboard_rpcs.sql"), "utf8")
record(
  "migration_098_dashboard_rpcs",
  rpcSql.includes("donation_org_payment_summary") &&
    rpcSql.includes("donation_payment_source_totals"),
  "dashboard RPCs present"
)

const listActions = fileIncludes("lib/donations/donation-list-actions.ts", [
  "fetchPaymentsPageAction",
  "fetchPledgesPageAction",
  "fetchDonorSummaryPageAction",
  ".range(",
])
record("server_pagination_actions", listActions.ok, listActions.missing.join(", ") || "ok")

const paginationConst = fileIncludes("lib/donations/donation-pagination.ts", [
  "DONATIONS_PAGE_SIZE",
])
record("donation_pagination_constant", paginationConst.ok, paginationConst.missing.join(", ") || "ok")

const paymentsPage = fileIncludes("app/(dashboard)/donations/payments/page.tsx", [
  "fetchPaymentsPageAction",
  "DONATIONS_PAGE_SIZE",
  "Pagination",
])
record("payments_page_pagination", paymentsPage.ok, paymentsPage.missing.join(", ") || "ok")

const pledgesPage = fileIncludes("app/(dashboard)/donations/pledges/page.tsx", [
  "fetchPledgesPageAction",
  "fetchPledgeSummaryMetricsAction",
])
record("pledges_page_pagination", pledgesPage.ok, pledgesPage.missing.join(", ") || "ok")

const donorsPage = fileIncludes("app/(dashboard)/donations/donors/page.tsx", [
  "DonorsPaginatedList",
])
record("donors_page_pagination", donorsPage.ok, donorsPage.missing.join(", ") || "ok")

const dashboardActions = fileIncludes("lib/donations/donation-dashboard-actions.ts", [
  "donation_org_payment_summary",
  "getDonationDashboardCampaignsAction",
])
record("dashboard_sql_summaries", dashboardActions.ok, dashboardActions.missing.join(", ") || "ok")

const opsPanel = fileIncludes("components/donations/donation-ops-panel.tsx", [
  "getDonationOpsSnapshotAction",
  "failedEmails",
])
record("ops_monitoring_panel", opsPanel.ok, opsPanel.missing.join(", ") || "ok")

const { error: viewError } = await sb.from("pledge_status_view").select("id").limit(1)
record("pledge_status_view_queryable", !viewError, viewError?.message || "ok")

const rpcChecks = await Promise.all([
  sb.rpc("donation_org_payment_summary", { p_org_id: orgId }),
  sb.rpc("donation_org_pledge_summary", { p_org_id: orgId }),
  sb.rpc("donation_monthly_payment_totals", { p_org_id: orgId, p_months: 6 }),
  sb.rpc("donation_payment_source_totals", { p_org_id: orgId, p_date_from: null }),
])

for (const [name, result] of [
  ["rpc_payment_summary", rpcChecks[0]],
  ["rpc_pledge_summary", rpcChecks[1]],
  ["rpc_monthly_totals", rpcChecks[2]],
  ["rpc_source_totals", rpcChecks[3]],
]) {
  record(name, !result.error, result.error?.message || "ok")
}

console.log("\n--- Stress benchmark (quick scale) ---\n")
const stress = spawnSync(
  process.execPath,
  [resolve(root, "scripts/beta-donations-stress-test.mjs"), "--scale=quick"],
  { cwd: root, env: process.env, encoding: "utf8" }
)
const stressOutput = `${stress.stdout || ""}\n${stress.stderr || ""}`
const timingMatches = [...stressOutput.matchAll(/(\w+):\s*(\d+)ms/g)]
for (const [, label, ms] of timingMatches) {
  record(`benchmark_${label}`, Number(ms) < 3000, `${ms}ms`)
}
record(
  "benchmark_stress_exit",
  stress.status === 0,
  `exit=${stress.status ?? "unknown"}`
)

const failed = checks.filter((c) => !c.pass)
console.log(`\n=== Summary: ${checks.length - failed.length}/${checks.length} passed ===`)
if (failed.length) {
  for (const check of failed) {
    console.log(`  - ${check.id}: ${check.detail}`)
  }
  process.exit(1)
}

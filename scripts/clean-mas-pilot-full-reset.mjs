/**
 * Full MAS Dallas pilot reset: wipe all contacts + donations ledger/config.
 * Preserves org, auth users, roles, donation_settings, programs catalog, modules.
 *
 * Usage:
 *   node scripts/clean-mas-pilot-full-reset.mjs
 *   node scripts/clean-mas-pilot-full-reset.mjs --execute --confirm-name="MAS Dallas"
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const STAMP = new Date().toISOString().slice(0, 10)
const MAS = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const MAS_NAME = "MAS Dallas"

/** Delete in FK-safe order (children before parents). Skipped if table missing. */
const DELETE_TABLES = [
  "transactional_email_log",
  "payment_processor_events",
  "donation_checkout_sessions",
  "pledge_reminders",
  "donation_receipts",
  "payments",
  "pledges",
  "recurring_donation_plans",
  "donors",
  "payment_import_batches",
  "application_documents",
  "application_history",
  "applications",
  "service_participations",
  "volunteer_assignments",
  "volunteers",
  "membership_status_history",
  "memberships",
  "employees",
  "customer_profiles",
  "contact_activities",
  "contact_notes",
  "contact_roles",
  "contact_group_members",
  "contact_payment_methods",
  "person_tags",
  "person_relationships",
  "contact_import_staging",
  "contacts",
  "people",
  "donation_subcategories",
  "donation_categories",
  "payment_methods",
  "campaigns",
]

/** Row counts must not decrease on execute. */
const PRESERVE_TABLES = [
  "organizations",
  "organization_members",
  "organization_roles",
  "role_permissions",
  "profiles",
  "organization_modules",
  "donation_settings",
  "organization_audit_logs",
  "programs",
  "program_sessions",
  "program_offerings",
]

function loadEnv() {
  const path = resolve(root, ".env.local")
  if (!existsSync(path)) throw new Error(".env.local not found")
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}

function parseArgs() {
  const confirmName = process.argv
    .find((a) => a.startsWith("--confirm-name="))
    ?.split("=")
    .slice(1)
    .join("=")
    ?.trim()
  return {
    execute: process.argv.includes("--execute"),
    confirmName: confirmName || null,
  }
}

function isSkippableTableError(message) {
  if (!message) return false
  return (
    message.includes("Could not find the table") ||
    message.includes("does not exist") ||
    message.includes("42P01") ||
    message.includes("PGRST205")
  )
}

loadEnv()

const { execute, confirmName } = parseArgs()

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function countOrg(table) {
  const { count, error } = await sb
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("organization_id", MAS)
  if (error) {
    if (isSkippableTableError(error.message)) return { count: null, skipped: true, error: null }
    return { count: null, skipped: false, error: error.message }
  }
  return { count: count ?? 0, skipped: false, error: null }
}

async function countOrgSingleton(table) {
  if (table === "organizations") {
    const { count, error } = await sb
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("id", MAS)
    return { count: count ?? 0, skipped: false, error: error?.message ?? null }
  }
  if (table === "profiles") {
    const { data: members } = await sb
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", MAS)
    const userIds = (members || []).map((m) => m.user_id).filter(Boolean)
    if (!userIds.length) return { count: 0, skipped: false, error: null }
    const { count, error } = await sb
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .in("id", userIds)
    return { count: count ?? 0, skipped: false, error: error?.message ?? null }
  }
  return countOrg(table)
}

async function fetchAllOrg(table) {
  const rows = []
  let from = 0
  while (true) {
    const { data, error } = await sb
      .from(table)
      .select("*")
      .eq("organization_id", MAS)
      .range(from, from + 999)
    if (error) {
      if (isSkippableTableError(error.message)) return { rows: [], skipped: true, error: null }
      return { rows: [], skipped: false, error: error.message }
    }
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return { rows, skipped: false, error: null }
}

async function deleteOrgRows(table) {
  if (!execute) {
    const { count } = await countOrg(table)
    return { table, deleted: count ?? 0, dryRun: true, skipped: false, error: null }
  }

  const { error, count } = await sb
    .from(table)
    .delete({ count: "exact" })
    .eq("organization_id", MAS)

  if (error) {
    if (isSkippableTableError(error.message)) {
      return { table, deleted: 0, skipped: true, error: null }
    }
    return { table, deleted: 0, skipped: false, error: error.message }
  }

  return { table, deleted: count ?? 0, skipped: false, error: null }
}

async function fetchOverview() {
  const { data, error } = await sb.rpc("donation_org_reports_overview", { p_org_id: MAS })
  if (error) return { error: error.message, data: null }
  return { error: null, data: data?.[0] ?? data }
}

async function main() {
  const { data: org, error: orgError } = await sb
    .from("organizations")
    .select("id, name")
    .eq("id", MAS)
    .maybeSingle()

  if (orgError || !org) {
    console.error("MAS Dallas org not found:", orgError?.message ?? "missing")
    process.exit(1)
  }

  if (execute && confirmName !== org.name) {
    console.error(
      `Refusing to execute: --confirm-name must exactly match org name "${org.name}".`
    )
    process.exit(1)
  }

  const backupDir = resolve(root, "scripts/backups/mas-pilot-full-reset")
  const reportDir = resolve(root, "scripts/reports")
  mkdirSync(backupDir, { recursive: true })
  mkdirSync(reportDir, { recursive: true })

  console.log(`=== MAS Dallas pilot full reset (${execute ? "EXECUTE" : "dry run"}) ===\n`)

  const before = {}
  for (const table of [...DELETE_TABLES, ...PRESERVE_TABLES]) {
    before[table] = await countOrgSingleton(table)
  }
  before.reportsOverview = await fetchOverview()

  console.log("Before (selected):")
  for (const table of [
    "contacts",
    "people",
    "donors",
    "payments",
    "pledges",
    "campaigns",
    "donation_categories",
  ]) {
    console.log(`  ${table}: ${before[table]?.count ?? "skipped"}`)
  }
  if (before.reportsOverview.data) {
    console.log(`  reports overview total_received: ${before.reportsOverview.data.total_received ?? "?"}`)
  }

  const exports = []
  for (const table of DELETE_TABLES) {
    const { rows, skipped, error } = await fetchAllOrg(table)
    if (skipped) {
      exports.push({ table, skipped: true })
      continue
    }
    if (error) {
      exports.push({ table, error })
      continue
    }
    if (rows.length === 0) {
      exports.push({ table, rowCount: 0 })
      continue
    }
    const file = resolve(backupDir, `${table}-mas-dallas-${STAMP}.json`)
    writeFileSync(
      file,
      JSON.stringify({ exportedAt: new Date().toISOString(), organizationId: MAS, rowCount: rows.length, rows }, null, 2)
    )
    exports.push({ table, rowCount: rows.length, file })
    console.log(`Exported ${table}: ${rows.length} rows`)
  }

  const deletionSteps = []
  if (execute) {
    console.log("\nDeleting...")
    for (const table of DELETE_TABLES) {
      const step = await deleteOrgRows(table)
      deletionSteps.push(step)
      console.log(
        `  ${table}: ${step.skipped ? "skipped" : `deleted ${step.deleted}`}${step.error ? ` ERROR ${step.error}` : ""}`
      )
      if (step.error) {
        console.error("\nStopped on first error.")
        break
      }
    }
  } else {
    console.log("\nDry run — no rows deleted.")
    console.log(`Re-run with: node scripts/clean-mas-pilot-full-reset.mjs --execute --confirm-name="${org.name}"`)
  }

  const after = {}
  for (const table of [...DELETE_TABLES, ...PRESERVE_TABLES]) {
    after[table] = await countOrgSingleton(table)
  }
  after.reportsOverview = await fetchOverview()

  const preserveOk = PRESERVE_TABLES.every((table) => {
    const b = before[table]?.count
    const a = after[table]?.count
    if (b == null || a == null) return true
    return a >= b
  })

  const wipeOk =
    execute &&
    (after.contacts?.count ?? -1) === 0 &&
    (after.payments?.count ?? -1) === 0 &&
    (after.pledges?.count ?? -1) === 0 &&
    (after.donors?.count ?? -1) === 0 &&
    (after.campaigns?.count ?? -1) === 0

  const report = {
    capturedAt: new Date().toISOString(),
    execute,
    organizationId: MAS,
    organizationName: org.name,
    before,
    after,
    exports,
    deletionSteps,
    preserveOk,
    wipeOk,
  }

  const reportPath = resolve(reportDir, `mas-pilot-full-reset-${STAMP}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log("\nAfter (selected):")
  for (const table of ["contacts", "people", "donors", "payments", "pledges", "campaigns"]) {
    console.log(`  ${table}: ${after[table]?.count ?? "skipped"}`)
  }
  if (after.reportsOverview.data) {
    console.log(`  reports overview total_received: ${after.reportsOverview.data.total_received ?? "?"}`)
  }

  console.log(`\nPreserve check: ${preserveOk ? "OK" : "FAILED"}`)
  if (execute) console.log(`Wipe check: ${wipeOk ? "OK" : "FAILED"}`)
  console.log(`Report: ${reportPath}`)
  console.log(`Backups: ${backupDir}`)

  if (execute && (!preserveOk || !wipeOk)) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

/**
 * Clear contact_import_staging for MAS Dallas pilot org only.
 *
 * Usage:
 *   node scripts/clear-mas-contact-import-staging.mjs           # pre-flight + export
 *   node scripts/clear-mas-contact-import-staging.mjs --execute # delete after export
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const execute = process.argv.includes("--execute")
const STAMP = "2026-06-16"

const MAS_DALLAS = {
  id: "e057e00a-e4e3-4adf-9af5-f465db1894be",
  name: "MAS Dallas",
  slug: "mas-dallas",
}

const PROTECTED_TABLES = [
  "profiles",
  "contacts",
  "people",
  "organization_members",
  "organization_users",
  "organizations",
  "organization_roles",
  "role_permissions",
  "modules",
  "organization_modules",
  "organization_sidebar_modules",
  "plans",
  "plan_modules",
  "plan_limits",
  "platform_admins",
  "platform_settings",
]

function loadEnvLocal() {
  const path = resolve(root, ".env.local")
  if (!existsSync(path)) throw new Error(".env.local not found")
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

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function count(table, filters = []) {
  let q = sb.from(table).select("*", { count: "exact", head: true })
  for (const f of filters) {
    if (f.op === "eq") q = q.eq(f.col, f.val)
  }
  const { count: n, error } = await q
  return { count: n ?? 0, error: error?.message ?? null }
}

async function fetchAll(table, filters = [], pageSize = 1000) {
  const rows = []
  let from = 0
  while (true) {
    let q = sb.from(table).select("*").range(from, from + pageSize - 1)
    for (const f of filters) {
      if (f.op === "eq") q = q.eq(f.col, f.val)
    }
    const { data, error } = await q
    if (error) return { rows, error: error.message }
    if (!data?.length) break
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return { rows, error: null }
}

async function snapshotProtected() {
  const snap = {}
  for (const table of PROTECTED_TABLES) {
    snap[table] = await count(table)
  }
  const auth = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
  snap.auth_users = { count: auth.data?.users?.length ?? null, error: auth.error?.message ?? null }
  return snap
}

async function confirmOrg() {
  const { data, error } = await sb
    .from("organizations")
    .select("id, name, slug")
    .eq("id", MAS_DALLAS.id)
    .maybeSingle()
  if (error || !data) {
    throw new Error(error?.message || "MAS Dallas organization not found")
  }
  return data
}

async function deleteMasStaging() {
  const { rows, error: fetchError } = await fetchAll("contact_import_staging", [
    { op: "eq", col: "organization_id", val: MAS_DALLAS.id },
  ])
  if (fetchError) return { deleted: 0, error: fetchError }

  let deleted = 0
  const BATCH = 200
  for (let i = 0; i < rows.length; i += BATCH) {
    const ids = rows.slice(i, i + BATCH).map((r) => r.id)
    const { error } = await sb.from("contact_import_staging").delete().in("id", ids)
    if (error) return { deleted, error: error.message }
    deleted += ids.length
  }
  return { deleted, error: null }
}

async function main() {
  const reportDir = resolve(root, "scripts/reports")
  const backupDir = resolve(root, "scripts/backups/contact-import-staging")
  mkdirSync(reportDir, { recursive: true })
  mkdirSync(backupDir, { recursive: true })

  const org = await confirmOrg()
  const beforeProtected = await snapshotProtected()
  const stagingMasBefore = await count("contact_import_staging", [
    { op: "eq", col: "organization_id", val: MAS_DALLAS.id },
  ])
  const stagingTotalBefore = await count("contact_import_staging")
  const stagingAsadBefore = await count("contact_import_staging", [
    { op: "eq", col: "organization_id", val: "95c4eb7d-b151-4aa1-a489-a3c1e1289c7e" },
  ])

  console.log("=== MAS Dallas contact_import_staging cleanup ===\n")
  console.log(`Organization: ${org.name} (${org.id}) slug=${org.slug}`)
  console.log(`MAS Dallas staging rows: ${stagingMasBefore.count}`)
  console.log(`Total staging rows (all orgs): ${stagingTotalBefore.count}`)
  console.log(`Asad Realty staging rows: ${stagingAsadBefore.count}`)

  const { rows: exportRows, error: exportError } = await fetchAll("contact_import_staging", [
    { op: "eq", col: "organization_id", val: MAS_DALLAS.id },
  ])
  if (exportError) throw new Error(exportError)

  const backupPath = resolve(backupDir, `contact_import_staging-mas-dallas-${STAMP}.json`)
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        organization: org,
        rowCount: exportRows.length,
        rows: exportRows,
      },
      null,
      2
    )
  )
  console.log(`\nBackup exported: ${backupPath} (${exportRows.length} rows)`)

  console.log("\nSafety: only contact_import_staging rows for MAS Dallas will be deleted.")
  console.log("contacts, people, profiles, auth.users, organization_members — NOT targeted.")

  if (!execute) {
    console.log("\nDry run complete. Re-run with --execute to delete.")
    return
  }

  const deletion = await deleteMasStaging()
  if (deletion.error) {
    console.error("Deletion failed:", deletion.error)
    process.exit(1)
  }

  const afterProtected = await snapshotProtected()
  const stagingMasAfter = await count("contact_import_staging", [
    { op: "eq", col: "organization_id", val: MAS_DALLAS.id },
  ])
  const stagingTotalAfter = await count("contact_import_staging")

  const protectedDiff = {}
  for (const table of PROTECTED_TABLES) {
    protectedDiff[table] = {
      before: beforeProtected[table].count,
      after: afterProtected[table].count,
      delta: afterProtected[table].count - beforeProtected[table].count,
    }
  }

  const report = {
    capturedAt: new Date().toISOString(),
    organization: org,
    A_preCleanup: {
      contact_import_staging_mas_dallas: stagingMasBefore.count,
      contact_import_staging_total: stagingTotalBefore.count,
      contact_import_staging_asad_realty: stagingAsadBefore.count,
      protected: beforeProtected,
    },
    B_backupExport: backupPath,
    C_deletionResult: {
      deleted: deletion.deleted,
      expected: stagingMasBefore.count,
      success: deletion.deleted === stagingMasBefore.count && stagingMasAfter.count === 0,
    },
    D_postCleanupValidation: {
      contact_import_staging_mas_dallas: stagingMasAfter.count,
      contact_import_staging_total: stagingTotalAfter.count,
      protectedDiff,
      auth_users: {
        before: beforeProtected.auth_users.count,
        after: afterProtected.auth_users.count,
        delta: (afterProtected.auth_users.count ?? 0) - (beforeProtected.auth_users.count ?? 0),
      },
    },
    E_onlyStagingAffected:
      Object.values(protectedDiff).every((d) => d.delta === 0) &&
      (afterProtected.auth_users.count ?? 0) === (beforeProtected.auth_users.count ?? 0),
  }

  const reportPath = resolve(reportDir, `mas-contact-import-staging-cleanup-${STAMP}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(`\nDeleted: ${deletion.deleted} rows`)
  console.log(`MAS staging after: ${stagingMasAfter.count}`)
  console.log(`contacts: ${beforeProtected.contacts.count} → ${afterProtected.contacts.count}`)
  console.log(`profiles: ${beforeProtected.profiles.count} → ${afterProtected.profiles.count}`)
  console.log(`auth.users: ${beforeProtected.auth_users.count} → ${afterProtected.auth_users.count}`)
  console.log(`organization_members: ${beforeProtected.organization_members.count} → ${afterProtected.organization_members.count}`)
  console.log(`Report: ${reportPath}`)
  console.log(`Only staging affected: ${report.E_onlyStagingAffected}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

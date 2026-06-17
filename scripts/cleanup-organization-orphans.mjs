/**
 * Remove leftover rows for a deleted organization id (members, roles, modules).
 *
 *   node scripts/cleanup-organization-orphans.mjs --org-id=95c4eb7d-b151-4aa1-a489-a3c1e1289c7e
 *   node scripts/cleanup-organization-orphans.mjs --org-id=95c4eb7d-b151-4aa1-a489-a3c1e1289c7e --execute
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const PROTECTED = new Set(["e057e00a-e4e3-4adf-9af5-f465db1894be"])

function loadEnvLocal() {
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

async function deleteByOrg(sb, table, orgId) {
  const { error, count } = await sb.from(table).delete({ count: "exact" }).eq("organization_id", orgId)
  return { table, deleted: count ?? 0, error: error?.message ?? null }
}

async function main() {
  loadEnvLocal()
  const orgId =
    process.argv.find((a) => a.startsWith("--org-id="))?.split("=")[1]?.trim() ||
    "95c4eb7d-b151-4aa1-a489-a3c1e1289c7e"
  const execute = process.argv.includes("--execute")

  if (PROTECTED.has(orgId)) {
    console.error("Protected org id")
    process.exit(1)
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const tables = [
    "organization_members",
    "role_permissions",
    "organization_roles",
    "organization_modules",
    "donation_settings",
    "organization_settings",
    "organization_invites",
  ]

  console.log(`Org orphan cleanup for ${orgId} (${execute ? "EXECUTE" : "DRY RUN"})\n`)

  for (const table of tables) {
    const { count, error } = await sb
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
    console.log(`${table}: ${error ? error.message : count ?? 0}`)
  }

  if (!execute) {
    console.log("\nAdd --execute to delete orphan rows.")
    return
  }

  console.log("")
  for (const table of tables) {
    const result = await deleteByOrg(sb, table, orgId)
    console.log(`${result.table}: deleted ${result.deleted}${result.error ? ` ERROR ${result.error}` : ""}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

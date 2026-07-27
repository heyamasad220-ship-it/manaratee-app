/**
 * Deactivate active households that have zero active members (leftover after merges).
 *
 * Usage:
 *   node scripts/deactivate-empty-households.mjs
 *   node scripts/deactivate-empty-households.mjs --execute
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"

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

async function main() {
  loadEnvLocal()
  const execute = process.argv.includes("--execute")
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data: families, error } = await sb
    .from("families")
    .select("id, name, primary_contact_id")
    .eq("organization_id", ORG_ID)
    .eq("status", "active")

  if (error) throw error

  const empty = []
  for (const family of families || []) {
    const { count } = await sb
      .from("family_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ORG_ID)
      .eq("family_id", family.id)
      .is("end_date", null)

    if ((count ?? 0) === 0) {
      empty.push(family)
    }
  }

  console.log(
    `${execute ? "EXECUTE" : "DRY-RUN"}: ${empty.length} empty active household(s)`
  )
  for (const family of empty) {
    console.log(`  ${family.name} (${family.id})`)
  }

  if (!execute || empty.length === 0) return

  for (const family of empty) {
    const { error: updateError } = await sb
      .from("families")
      .update({ status: "inactive" })
      .eq("id", family.id)
      .eq("organization_id", ORG_ID)
    if (updateError) {
      console.warn(`Failed ${family.id}: ${updateError.message}`)
    }
  }
  console.log(`Deactivated ${empty.length} household(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

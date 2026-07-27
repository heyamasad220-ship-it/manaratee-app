/**
 * Strip trailing " Family" from household names (e.g. "Suleiman Family" → "Suleiman").
 *
 * Usage:
 *   node scripts/strip-household-family-suffix.mjs
 *   node scripts/strip-household-family-suffix.mjs --execute
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

function stripSuffix(name) {
  return String(name || "")
    .trim()
    .replace(/\s+Family$/i, "")
    .trim()
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
    .select("id, name")
    .eq("organization_id", ORG_ID)
    .eq("status", "active")

  if (error) throw new Error(error.message)

  const updates = []
  for (const family of families || []) {
    const current = String(family.name || "").trim()
    const next = stripSuffix(current)
    if (!next || next === current) continue
    updates.push({ id: family.id, from: current, to: next })
  }

  console.log(
    `${execute ? "EXECUTE" : "DRY-RUN"}: ${updates.length} household(s) to rename`
  )
  for (const row of updates.slice(0, 20)) {
    console.log(`  ${row.from} → ${row.to}`)
  }
  if (updates.length > 20) {
    console.log(`  ... and ${updates.length - 20} more`)
  }

  if (!execute || updates.length === 0) return

  for (const row of updates) {
    const { error: updateError } = await sb
      .from("families")
      .update({ name: row.to })
      .eq("id", row.id)
      .eq("organization_id", ORG_ID)
    if (updateError) {
      console.warn(`Failed ${row.id}: ${updateError.message}`)
    }
  }
  console.log(`Updated ${updates.length} household name(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

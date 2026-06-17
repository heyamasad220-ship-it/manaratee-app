/**
 * Export backup_* tables to JSON for Phase 0 archive (read-only export).
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith("#")) continue
  const eq = t.indexOf("=")
  if (eq === -1) continue
  const k = t.slice(0, eq).trim()
  let v = t.slice(eq + 1).trim()
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1)
  }
  if (!process.env[k]) process.env[k] = v
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const BACKUP_TABLES = [
  "backup_donors_2026_05_24",
  "backup_payments_2026_05_24",
  "backup_donation_pledges_2026_05_24",
  "backup_donation_payments_2026_05_24",
  "backup_pledges_2026_05_24",
]

const outDir = resolve(root, "scripts/backups")
mkdirSync(outDir, { recursive: true })
const stamp = "2026-06-16"
const manifest = { exportedAt: new Date().toISOString(), tables: {} }

for (const table of BACKUP_TABLES) {
  const { data, error, count } = await sb
    .from(table)
    .select("*", { count: "exact" })
    .range(0, 99999)
  if (error) {
    manifest.tables[table] = { error: error.message }
    continue
  }
  const path = resolve(outDir, `${table}-${stamp}.json`)
  writeFileSync(path, JSON.stringify(data ?? [], null, 2))
  manifest.tables[table] = { rowCount: count ?? data?.length ?? 0, file: path }
}

const manifestPath = resolve(outDir, `backup-tables-manifest-${stamp}.json`)
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
console.log(JSON.stringify({ ok: true, manifestPath, manifest }, null, 2))

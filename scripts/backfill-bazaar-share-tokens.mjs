/**
 * Backfill public_share_token on vendor_hub_events missing one.
 *   node scripts/backfill-bazaar-share-tokens.mjs --execute
 */
import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
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

loadEnvLocal()
const execute = process.argv.includes("--execute")

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const { data: events, error } = await sb
  .from("vendor_hub_events")
  .select("id, name, public_share_token")
  .eq("organization_id", ORG_ID)
  .is("public_share_token", null)

if (error) {
  console.error(error)
  process.exit(1)
}

const report = {
  mode: execute ? "execute" : "dry-run",
  missing: events?.length || 0,
  updated: 0,
  errors: [],
}

if (!execute) {
  console.log(JSON.stringify(report, null, 2))
  console.log("Dry-run only. Re-run with --execute.")
  process.exit(0)
}

for (const event of events || []) {
  const token = randomBytes(16).toString("hex")
  const { error: updateError } = await sb
    .from("vendor_hub_events")
    .update({ public_share_token: token })
    .eq("id", event.id)
    .eq("organization_id", ORG_ID)
  if (updateError) {
    report.errors.push({ id: event.id, error: updateError.message })
  } else {
    report.updated += 1
  }
}

const outDir = resolve(root, "scripts/reports")
mkdirSync(outDir, { recursive: true })
const outPath = resolve(outDir, "backfill-bazaar-share-tokens.json")
writeFileSync(outPath, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
console.log(`Wrote ${outPath}`)

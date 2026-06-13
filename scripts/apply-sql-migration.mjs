/**
 * Apply a SQL migration file when DATABASE_URL is set, or via Supabase CLI:
 *   npx supabase db query --linked -f scripts/088_payments_source_type_check.sql
 * Usage: node scripts/apply-sql-migration.mjs scripts/088_payments_source_type_check.sql
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

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

const sqlFile = process.argv[2]
if (!sqlFile) {
  console.error("Usage: node scripts/apply-sql-migration.mjs <path-to.sql>")
  process.exit(1)
}

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL

if (!databaseUrl) {
  console.error(
    "Set DATABASE_URL, SUPABASE_DB_URL, or POSTGRES_URL in .env.local to apply migrations from the CLI."
  )
  process.exit(1)
}

const sqlPath = resolve(root, sqlFile)
const sql = readFileSync(sqlPath, "utf8")

const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlPath], {
  encoding: "utf8",
  shell: process.platform === "win32",
})

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)

if (result.status !== 0) {
  console.error(`Migration failed (exit ${result.status})`)
  process.exit(result.status || 1)
}

console.log(`Applied ${sqlFile}`)

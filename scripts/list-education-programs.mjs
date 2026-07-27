/**
 * List Education department programs/years for QLH import planning.
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
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
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const { data: depts, error: dErr } = await sb
  .from("departments")
  .select("id, name")
  .eq("organization_id", ORG_ID)
  .or("name.ilike.%education%,name.ilike.%qlh%,name.ilike.%quran%learn%")
if (dErr) throw dErr
console.log("departments", depts)

for (const dept of depts || []) {
  const { data: programs, error } = await sb
    .from("programs")
    .select("id, name, start_date, end_date, status, department_id")
    .eq("organization_id", ORG_ID)
    .eq("department_id", dept.id)
    .order("start_date", { ascending: false })
  if (error) throw error
  console.log("\nprograms for", dept.name)
  for (const p of programs || []) {
    const { count } = await sb
      .from("program_offerings")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ORG_ID)
      .eq("program_id", p.id)
    console.log({ ...p, offerings: count })
  }
}

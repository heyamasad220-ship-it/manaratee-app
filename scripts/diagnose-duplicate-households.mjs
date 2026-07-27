/**
 * Diagnose duplicate households for a name (default Shawky).
 * Usage: node scripts/diagnose-duplicate-households.mjs [name]
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
  const name = (process.argv[2] || "Shawky").trim()
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data: families, error } = await sb
    .from("families")
    .select("id, name, status, primary_contact_id, created_at")
    .eq("organization_id", ORG_ID)
    .ilike("name", name)
    .order("created_at", { ascending: true })

  if (error) throw error

  for (const family of families || []) {
    const { data: members } = await sb
      .from("family_members")
      .select(
        "id, contact_id, person_id, role, end_date, contact:contact_id ( full_name ), person:person_id ( first_name, last_name )"
      )
      .eq("organization_id", ORG_ID)
      .eq("family_id", family.id)

    const { data: primary } = await sb
      .from("contacts")
      .select("id, full_name, email")
      .eq("id", family.primary_contact_id)
      .maybeSingle()

    const active = (members || []).filter((m) => !m.end_date)
    console.log("\n---")
    console.log({
      id: family.id,
      name: family.name,
      status: family.status,
      primary: primary,
      activeCount: active.length,
      members: active.map((m) => ({
        role: m.role,
        contact: m.contact?.full_name || null,
        person: m.person
          ? `${m.person.first_name || ""} ${m.person.last_name || ""}`.trim()
          : null,
        contact_id: m.contact_id,
        person_id: m.person_id,
      })),
      ended: (members || [])
        .filter((m) => m.end_date)
        .map((m) => ({
          end_date: m.end_date,
          contact: m.contact?.full_name || null,
          person: m.person
            ? `${m.person.first_name || ""} ${m.person.last_name || ""}`.trim()
            : null,
        })),
    })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

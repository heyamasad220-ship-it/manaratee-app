/**
 * Diagnose Programs affiliation for a contact (default: Susan Almasri).
 * Usage: node scripts/diagnose-programs-affiliation.mjs [email-or-name]
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
  const needle = (process.argv[2] || "Susan Almasri").trim()
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  let q = sb
    .from("contacts")
    .select("id, full_name, email")
    .eq("organization_id", ORG_ID)
  if (needle.includes("@")) {
    q = q.ilike("email", needle)
  } else {
    q = q.ilike("full_name", `%${needle}%`)
  }
  const { data: contacts, error } = await q.limit(5)
  if (error) throw error
  console.log("contacts", contacts)
  const contact = contacts?.[0]
  if (!contact) return

  const id = contact.id
  const { data: roles } = await sb
    .from("contact_roles")
    .select("role, is_manual")
    .eq("organization_id", ORG_ID)
    .eq("contact_id", id)
  console.log("roles", roles)

  for (const field of [
    "participant_contact_id",
    "registrant_contact_id",
    "payer_contact_id",
  ]) {
    const { data, error: eErr } = await sb
      .from("program_enrollments")
      .select(
        "id, status, participant_contact_id, registrant_contact_id, payer_contact_id, child_name"
      )
      .eq("organization_id", ORG_ID)
      .eq(field, id)
    console.log(`enrollments by ${field}`, eErr?.message || data)
  }

  const { data: charges } = await sb
    .from("program_charges")
    .select("id, total, amount_paid, paid_at, payer_contact_id, enrollment_id")
    .eq("organization_id", ORG_ID)
    .eq("payer_contact_id", id)
  console.log("charges as payer", charges)

  const { data: settings } = await sb
    .from("organization_affiliation_settings")
    .select("role, auto_sync_enabled")
    .eq("organization_id", ORG_ID)
    .eq("role", "program_participant")
  console.log("program_participant auto-sync", settings)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

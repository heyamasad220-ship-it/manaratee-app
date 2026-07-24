/**
 * Fix QIL imported enrollments: registration date + adult contact fields.
 * Usage: node scripts/fix-qil-enrollment-display.mjs --execute
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const PROGRAM_NAME = "Quran Institute for Ladies 2025-2026"
const ENROLLMENT_DATE = "2025-09-01"

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
    { auth: { persistSession: false } }
  )

  const { data: program, error } = await sb
    .from("programs")
    .select("id, name")
    .eq("organization_id", ORG_ID)
    .eq("name", PROGRAM_NAME)
    .maybeSingle()

  if (error || !program) {
    throw new Error(error?.message || "QIL 2025-2026 program not found")
  }

  const { data: enrollments, error: enrError } = await sb
    .from("program_enrollments")
    .select("id, child_name, parent_name, participant_contact_id, notes")
    .eq("organization_id", ORG_ID)
    .eq("program_id", program.id)

  if (enrError) throw new Error(enrError.message)

  console.log(`Found ${enrollments?.length || 0} enrollments on ${PROGRAM_NAME}`)
  if (!execute) {
    console.log("Dry-run. Re-run with --execute to apply.")
    return
  }

  const contactIds = [
    ...new Set(
      (enrollments || [])
        .map((e) => e.participant_contact_id)
        .filter(Boolean)
    ),
  ]
  const { data: contacts } = await sb
    .from("contacts")
    .select("id, email, phone, full_name")
    .eq("organization_id", ORG_ID)
    .in("id", contactIds)

  const contactById = new Map((contacts || []).map((c) => [c.id, c]))

  let updated = 0
  for (const enrollment of enrollments || []) {
    const contact = enrollment.participant_contact_id
      ? contactById.get(enrollment.participant_contact_id)
      : null
    const { error: updateError } = await sb
      .from("program_enrollments")
      .update({
        enrollment_date: ENROLLMENT_DATE,
        participant_type: "adult",
        registrant_type: "adult_self",
        parent_name: enrollment.child_name,
        parent_email: contact?.email || null,
        parent_phone: contact?.phone || null,
      })
      .eq("id", enrollment.id)
      .eq("organization_id", ORG_ID)

    if (updateError) {
      console.warn(enrollment.id, updateError.message)
      continue
    }
    updated += 1
  }

  console.log(`Updated ${updated} enrollments (date ${ENROLLMENT_DATE}, adult contact).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

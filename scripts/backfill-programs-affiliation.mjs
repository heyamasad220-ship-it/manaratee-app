/**
 * Backfill Programs (program_participant) roles for contacts linked to enrollments/charges.
 * Does not require sync_contact_affiliations RPC (which may be broken until SQL 197 is applied).
 *
 * Usage:
 *   node scripts/backfill-programs-affiliation.mjs
 *   node scripts/backfill-programs-affiliation.mjs --execute
 *   node scripts/backfill-programs-affiliation.mjs --contact dc295d56-4c8d-4a73-8d57-e8affe47de50 --execute
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

function argValue(flag) {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return null
  return process.argv[idx + 1] || null
}

async function main() {
  loadEnvLocal()
  const execute = process.argv.includes("--execute")
  const onlyContact = argValue("--contact")
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const contactIds = new Set()

  const { data: enrollments, error: eErr } = await sb
    .from("program_enrollments")
    .select("participant_contact_id, registrant_contact_id, payer_contact_id, status")
    .eq("organization_id", ORG_ID)
    .not("status", "in", "(cancelled,withdrawn,transferred)")
  if (eErr) throw eErr

  for (const row of enrollments || []) {
    for (const key of [
      "participant_contact_id",
      "registrant_contact_id",
      "payer_contact_id",
    ]) {
      if (row[key]) contactIds.add(row[key])
    }
  }

  const { data: charges, error: cErr } = await sb
    .from("program_charges")
    .select("payer_contact_id, amount_paid")
    .eq("organization_id", ORG_ID)
    .gt("amount_paid", 0)
  if (cErr) throw cErr
  for (const row of charges || []) {
    if (row.payer_contact_id) contactIds.add(row.payer_contact_id)
  }

  let ids = [...contactIds]
  if (onlyContact) {
    ids = ids.includes(onlyContact) ? [onlyContact] : [onlyContact]
  }

  console.log(
    `${execute ? "EXECUTE" : "DRY-RUN"}: ${ids.length} contact(s) eligible for Programs tag`
  )

  let inserted = 0
  let already = 0
  for (const contactId of ids) {
    const { data: existing } = await sb
      .from("contact_roles")
      .select("id")
      .eq("organization_id", ORG_ID)
      .eq("contact_id", contactId)
      .eq("role", "program_participant")
      .maybeSingle()

    if (existing?.id) {
      already += 1
      continue
    }

    if (!execute) {
      inserted += 1
      continue
    }

    const { error } = await sb.from("contact_roles").insert({
      organization_id: ORG_ID,
      contact_id: contactId,
      role: "program_participant",
      is_manual: false,
    })
    if (error) {
      console.warn(`insert failed ${contactId}: ${error.message}`)
      continue
    }
    inserted += 1
  }

  console.log({ wouldOrDidInsert: inserted, alreadyHadPrograms: already })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

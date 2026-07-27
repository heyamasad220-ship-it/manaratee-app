/**
 * Sync affiliations for one contact (or all with program enrollments missing Programs tag).
 * Usage:
 *   node scripts/sync-programs-affiliation.mjs --contact dc295d56-4c8d-4a73-8d57-e8affe47de50
 *   node scripts/sync-programs-affiliation.mjs --backfill --execute
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
  const backfill = process.argv.includes("--backfill")
  const contactId = argValue("--contact")
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  let contactIds = []
  if (contactId) {
    contactIds = [contactId]
  } else if (backfill) {
    const { data: enrollments, error } = await sb
      .from("program_enrollments")
      .select("participant_contact_id, registrant_contact_id, payer_contact_id, status")
      .eq("organization_id", ORG_ID)
      .not("status", "in", "(cancelled,withdrawn,transferred)")
    if (error) throw error
    const set = new Set()
    for (const row of enrollments || []) {
      for (const key of [
        "participant_contact_id",
        "registrant_contact_id",
        "payer_contact_id",
      ]) {
        const id = row[key]
        if (id) set.add(id)
      }
    }
    contactIds = [...set]
  } else {
    console.error("Pass --contact <id> or --backfill")
    process.exit(1)
  }

  console.log(
    `${execute ? "EXECUTE" : "DRY-RUN"}: sync ${contactIds.length} contact(s)`
  )

  let synced = 0
  let withPrograms = 0
  for (const id of contactIds) {
    if (execute) {
      const { error } = await sb.rpc("sync_contact_affiliations", {
        p_organization_id: ORG_ID,
        p_contact_id: id,
      })
      if (error) {
        console.warn(`sync failed ${id}: ${error.message}`)
        continue
      }
      synced += 1
    }

    const { data: roles } = await sb
      .from("contact_roles")
      .select("role")
      .eq("organization_id", ORG_ID)
      .eq("contact_id", id)
    const hasPrograms = (roles || []).some((r) => r.role === "program_participant")
    if (hasPrograms) withPrograms += 1
    if (contactId || contactIds.length <= 5) {
      console.log(id, (roles || []).map((r) => r.role).join(", ") || "(none)")
    }
  }

  console.log({ synced, withProgramsAfterCheck: withPrograms, total: contactIds.length })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

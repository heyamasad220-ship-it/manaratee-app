/**
 * Ensure QIL imported enrollments have CRM contact profiles with Customer affiliation
 * (unified tag that replaced legacy "program participant").
 *
 * Usage:
 *   node scripts/sync-qil-participant-contacts.mjs
 *   node scripts/sync-qil-participant-contacts.mjs --execute
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const PROGRAM_NAME = "Quran Institute for Ladies 2025-2026"
const execute = process.argv.includes("--execute")

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

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

async function ensureContact(sb, orgId, fullName, email, phone, cache) {
  const key = normalizeName(fullName)
  if (cache.has(key)) return cache.get(key)

  if (email) {
    const { data: byEmail } = await sb
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", orgId)
      .eq("contact_type", "individual")
      .eq("email", email)
      .maybeSingle()
    if (byEmail) {
      cache.set(key, byEmail)
      return byEmail
    }
  }

  const { data: byName } = await sb
    .from("contacts")
    .select("id, full_name, email, phone")
    .eq("organization_id", orgId)
    .eq("contact_type", "individual")
    .ilike("full_name", fullName)
    .limit(1)
    .maybeSingle()
  if (byName) {
    cache.set(key, byName)
    return byName
  }

  if (!execute) {
    const placeholder = {
      id: `dry-run:${key}`,
      full_name: fullName,
      email: email || null,
      phone: phone || null,
      created: true,
    }
    cache.set(key, placeholder)
    return placeholder
  }

  const { data, error } = await sb
    .from("contacts")
    .insert({
      organization_id: orgId,
      full_name: fullName,
      email: email || null,
      phone: phone || null,
      contact_type: "individual",
      status: "active",
    })
    .select("id, full_name, email, phone")
    .single()
  if (error) throw new Error(`contact create (${fullName}): ${error.message}`)
  cache.set(key, { ...data, created: true })
  return cache.get(key)
}

async function main() {
  loadEnvLocal()
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  const { data: program, error: programError } = await sb
    .from("programs")
    .select("id, name")
    .eq("organization_id", ORG_ID)
    .eq("name", PROGRAM_NAME)
    .maybeSingle()

  if (programError || !program) {
    throw new Error(programError?.message || "QIL program not found")
  }

  const { data: enrollments, error: enrError } = await sb
    .from("program_enrollments")
    .select(
      "id, child_name, parent_email, parent_phone, participant_contact_id, registrant_contact_id, payer_contact_id"
    )
    .eq("organization_id", ORG_ID)
    .eq("program_id", program.id)

  if (enrError) throw new Error(enrError.message)

  const cache = new Map()
  let created = 0
  let linked = 0
  let synced = 0
  let syncFailed = 0
  const contactIds = new Set()

  for (const enrollment of enrollments || []) {
    let contactId = enrollment.participant_contact_id

    if (!contactId) {
      const contact = await ensureContact(
        sb,
        ORG_ID,
        enrollment.child_name,
        enrollment.parent_email,
        enrollment.parent_phone,
        cache
      )
      contactId = contact.id
      if (contact.created) created += 1

      if (execute && !String(contactId).startsWith("dry-run:")) {
        const { error: linkError } = await sb
          .from("program_enrollments")
          .update({
            participant_contact_id: contactId,
            registrant_contact_id: contactId,
            payer_contact_id: contactId,
            participant_type: "adult",
            registrant_type: "adult_self",
          })
          .eq("id", enrollment.id)
          .eq("organization_id", ORG_ID)
        if (linkError) {
          console.warn("link failed", enrollment.child_name, linkError.message)
          continue
        }
        linked += 1
      } else if (!execute) {
        linked += 1
      }
    }

    if (contactId && !String(contactId).startsWith("dry-run:")) {
      contactIds.add(contactId)
    }
  }

  for (const contactId of contactIds) {
    if (!execute) {
      synced += 1
      continue
    }
    const { error } = await sb.rpc("sync_contact_affiliations", {
      p_organization_id: ORG_ID,
      p_contact_id: contactId,
    })
    if (error) {
      syncFailed += 1
      console.warn("sync failed", contactId, error.message)
      continue
    }
    synced += 1
  }

  console.log({
    enrollments: enrollments?.length || 0,
    uniqueContacts: contactIds.size,
    contactsCreated: created,
    enrollmentsLinked: linked,
    affiliationsSynced: synced,
    syncFailed,
    mode: execute ? "execute" : "dry-run",
    note: 'Programs affiliation (program_participant) for enrollments; Customer stays events/venue',
  })

  if (!execute) {
    console.log("Dry-run complete. Re-run with --execute to apply.")
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

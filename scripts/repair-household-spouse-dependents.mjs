/**
 * Repair: after linking spouses, import each other's child dependents into the
 * shared household and mirror child person_relationships onto both parents.
 *
 * Usage:
 *   node scripts/repair-household-spouse-dependents.mjs --anchor <contactId> --member <contactId>
 *   node scripts/repair-household-spouse-dependents.mjs --anchor 49e1e8c6-3ebe-4297-bb35-1818da6aeeba --member dc295d56-4c8d-4a73-8d57-e8affe47de50 --execute
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

async function ensurePersonRelationship(sb, personId, relatedPersonId, relationshipType) {
  const { data: existing } = await sb
    .from("person_relationships")
    .select("id")
    .eq("organization_id", ORG_ID)
    .eq("person_id", personId)
    .eq("related_person_id", relatedPersonId)
    .maybeSingle()
  if (existing?.id) return existing.id

  const { data, error } = await sb
    .from("person_relationships")
    .insert({
      organization_id: ORG_ID,
      person_id: personId,
      related_person_id: relatedPersonId,
      relationship_type: relationshipType,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

async function upsertChildMember(sb, familyId, childPersonId, isMinor) {
  const { data: existing } = await sb
    .from("family_members")
    .select("id, family_id")
    .eq("organization_id", ORG_ID)
    .eq("person_id", childPersonId)
    .is("end_date", null)
    .maybeSingle()

  if (existing?.id && existing.family_id === familyId) {
    return { action: "already" }
  }

  if (existing?.id && existing.family_id !== familyId) {
    const today = new Date().toISOString().slice(0, 10)
    await sb.from("family_members").update({ end_date: today }).eq("id", existing.id)
  }

  let contactId = null
  if (!isMinor) {
    const { data: contact } = await sb
      .from("contacts")
      .select("id")
      .eq("organization_id", ORG_ID)
      .eq("person_id", childPersonId)
      .maybeSingle()
    contactId = contact?.id || null
  }

  const { error } = await sb.from("family_members").insert({
    organization_id: ORG_ID,
    family_id: familyId,
    contact_id: contactId,
    person_id: childPersonId,
    role: "child",
    start_date: new Date().toISOString().slice(0, 10),
  })
  if (error) throw new Error(error.message)
  return { action: "inserted" }
}

async function importKids(sb, sourcePersonId, mirrorPersonId, familyId, execute) {
  const { data: childRels } = await sb
    .from("person_relationships")
    .select("related_person_id")
    .eq("organization_id", ORG_ID)
    .eq("person_id", sourcePersonId)
    .eq("relationship_type", "child")

  const childIds = (childRels || []).map((r) => r.related_person_id).filter(Boolean)
  if (childIds.length === 0) return []

  const { data: people } = await sb
    .from("people")
    .select("id, first_name, last_name, date_of_birth")
    .eq("organization_id", ORG_ID)
    .in("id", childIds)

  const results = []
  for (const person of people || []) {
    const birth = person.date_of_birth ? new Date(`${person.date_of_birth}T00:00:00`) : null
    let age = null
    if (birth && !Number.isNaN(birth.getTime())) {
      const today = new Date()
      age = today.getFullYear() - birth.getFullYear()
      const m = today.getMonth() - birth.getMonth()
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1
    }
    const isMinor = age === null || age < 18
    const name = `${person.first_name || ""} ${person.last_name || ""}`.trim()

    if (execute) {
      const memberResult = await upsertChildMember(sb, familyId, person.id, isMinor)
      await ensurePersonRelationship(sb, mirrorPersonId, person.id, "child")
      results.push({ name, ...memberResult, mirrored: true })
    } else {
      results.push({ name, action: "would-import", mirrored: true })
    }
  }
  return results
}

async function main() {
  loadEnvLocal()
  const execute = process.argv.includes("--execute")
  const anchorId = argValue("--anchor")
  const memberId = argValue("--member")
  if (!anchorId || !memberId) {
    console.error("Required: --anchor <contactId> --member <contactId>")
    process.exit(1)
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data: membership } = await sb
    .from("family_members")
    .select("family_id, families:family_id ( id, name, status, primary_contact_id )")
    .eq("organization_id", ORG_ID)
    .eq("contact_id", anchorId)
    .is("end_date", null)
    .maybeSingle()

  const family = Array.isArray(membership?.families)
    ? membership?.families[0]
    : membership?.families
  if (!family?.id || family.status !== "active") {
    throw new Error("Anchor is not in an active household.")
  }

  const { data: contacts } = await sb
    .from("contacts")
    .select("id, full_name, person_id")
    .eq("organization_id", ORG_ID)
    .in("id", [anchorId, memberId])

  const anchor = contacts?.find((c) => c.id === anchorId)
  const member = contacts?.find((c) => c.id === memberId)
  if (!anchor?.person_id || !member?.person_id) {
    throw new Error("Both contacts need person_id.")
  }

  console.log(
    `${execute ? "EXECUTE" : "DRY-RUN"} household ${family.name} (${family.id})`
  )
  console.log(`Anchor: ${anchor.full_name}`)
  console.log(`Member: ${member.full_name}`)

  const fromMember = await importKids(
    sb,
    member.person_id,
    anchor.person_id,
    family.id,
    execute
  )
  const fromAnchor = await importKids(
    sb,
    anchor.person_id,
    member.person_id,
    family.id,
    execute
  )

  console.log("Imported from member → anchor:", fromMember)
  console.log("Imported from anchor → member:", fromAnchor)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

/**
 * Sync Summer Camp (and any) parent contacts into Families households so minors
 * appear as person-only members alongside the adult Contact.
 *
 * Requires SQL 196_family_members_person.sql first.
 *
 * Usage:
 *   node scripts/sync-summer-camp-households.mjs
 *   node scripts/sync-summer-camp-households.mjs --execute
 *   node scripts/sync-summer-camp-households.mjs --all-parents --execute
 *   node scripts/sync-summer-camp-households.mjs --camp-parents --execute
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const PROGRAM_ID = "e6436c28-666c-4327-b3c1-4234d2379a42"
const CAMP_DEPARTMENT_ID = "d0c78557-1574-487d-8278-e17009fc7ecf"

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

async function must(label, promise) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

function mapRole(relationshipType) {
  switch (String(relationshipType || "").toLowerCase()) {
    case "spouse":
      return "spouse"
    case "child":
      return "child"
    case "parent":
      return "parent"
    case "sibling":
      return "sibling"
    case "guardian":
      return "guardian"
    default:
      return "other"
  }
}

function ageYears(dob) {
  if (!dob) return null
  const today = new Date()
  const birth = new Date(`${dob}T00:00:00`)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

async function upsertMember(sb, { familyId, contactId, personId, role }) {
  if (personId) {
    const { data: existing } = await sb
      .from("family_members")
      .select("id, family_id")
      .eq("organization_id", ORG_ID)
      .eq("person_id", personId)
      .is("end_date", null)
      .maybeSingle()
    if (existing?.id) {
      if (existing.family_id !== familyId) {
        await sb
          .from("family_members")
          .update({ end_date: new Date().toISOString().slice(0, 10) })
          .eq("id", existing.id)
      } else {
        await sb
          .from("family_members")
          .update({
            role,
            contact_id: contactId,
            person_id: personId,
            end_date: null,
          })
          .eq("id", existing.id)
        return "updated"
      }
    }
  }

  const { error } = await sb.from("family_members").insert({
    organization_id: ORG_ID,
    family_id: familyId,
    contact_id: contactId,
    person_id: personId,
    role,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: null,
  })
  if (error && !/duplicate|unique/i.test(error.message)) {
    throw new Error(error.message)
  }
  return "inserted"
}

async function syncParent(sb, contact, execute, report) {
  const parentPersonId = contact.person_id
  if (!parentPersonId) {
    report.warnings.push(`Contact ${contact.full_name} has no person_id`)
    return
  }

  const relationships = await must(
    `rels ${contact.id}`,
    sb
      .from("person_relationships")
      .select("id, related_person_id, relationship_type")
      .eq("organization_id", ORG_ID)
      .eq("person_id", parentPersonId)
  )

  report.actions.push(
    `${contact.full_name}: ${relationships.length} related people`
  )

  if (!execute) {
    report.counts.parentsSynced += 1
    return
  }

  // Prefer an existing household that already contains one of the kids.
  let familyId = null
  for (const rel of relationships) {
    const { data: member } = await sb
      .from("family_members")
      .select("family_id, families:family_id ( id, status )")
      .eq("organization_id", ORG_ID)
      .eq("person_id", rel.related_person_id)
      .is("end_date", null)
      .maybeSingle()
    const family = Array.isArray(member?.families)
      ? member?.families[0]
      : member?.families
    if (family?.id && family.status === "active") {
      familyId = family.id
      break
    }
  }

  // Load related people before creating/renaming the household.
  const relatedIds = relationships.map((r) => r.related_person_id)
  const people =
    relatedIds.length > 0
      ? await must(
          "people",
          sb
            .from("people")
            .select("id, date_of_birth, first_name, last_name")
            .eq("organization_id", ORG_ID)
            .in("id", relatedIds)
        )
      : []
  const peopleById = new Map(people.map((p) => [p.id, p]))
  const householdName = deriveNameFromKids(
    relationships,
    peopleById,
    contact.full_name
  )

  if (!familyId) {
    const { data: asPrimary } = await sb
      .from("families")
      .select("id, name")
      .eq("organization_id", ORG_ID)
      .eq("primary_contact_id", contact.id)
      .eq("status", "active")
      .maybeSingle()
    familyId = asPrimary?.id || null
  }

  if (!familyId) {
    const { data: asMember } = await sb
      .from("family_members")
      .select("family_id")
      .eq("organization_id", ORG_ID)
      .eq("contact_id", contact.id)
      .is("end_date", null)
      .maybeSingle()
    familyId = asMember?.family_id || null
  }

  if (!familyId) {
    const created = await must(
      `create family ${contact.full_name}`,
      sb
        .from("families")
        .insert({
          organization_id: ORG_ID,
          name: householdName,
          status: "active",
          primary_contact_id: contact.id,
        })
        .select("id")
        .single()
    )
    familyId = created.id
    report.counts.familiesCreated += 1
  } else if (execute) {
    const { data: familyRow } = await sb
      .from("families")
      .select("name")
      .eq("id", familyId)
      .maybeSingle()
    const currentName = (familyRow?.name || "").trim()
    const parentFull = (contact.full_name || "").trim()
    const withoutFamilySuffix = currentName.replace(/\s+Family$/i, "").trim()
    const shouldRename =
      currentName &&
      currentName !== householdName &&
      (currentName.toLowerCase() === `${parentFull} Family`.toLowerCase() ||
        currentName.toLowerCase() === parentFull.toLowerCase() ||
        withoutFamilySuffix.toLowerCase() === householdName.toLowerCase() ||
        withoutFamilySuffix.toLowerCase() === parentFull.toLowerCase())
    if (shouldRename) {
      await sb
        .from("families")
        .update({ name: householdName })
        .eq("id", familyId)
        .eq("organization_id", ORG_ID)
      report.actions.push(`Renamed household → ${householdName}`)
    }
  }

  const { data: familyRow } = await sb
    .from("families")
    .select("primary_contact_id")
    .eq("id", familyId)
    .maybeSingle()

  const parentRole =
    familyRow?.primary_contact_id === contact.id ? "head" : "spouse"

  await upsertMember(sb, {
    familyId,
    contactId: contact.id,
    personId: parentPersonId,
    role: parentRole,
  })

  const relatedContacts =
    relatedIds.length > 0
      ? await must(
          "related contacts",
          sb
            .from("contacts")
            .select("id, person_id")
            .eq("organization_id", ORG_ID)
            .in("person_id", relatedIds)
        )
      : []
  const contactByPerson = new Map(
    relatedContacts.map((c) => [c.person_id, c.id])
  )

  for (const rel of relationships) {
    const person = peopleById.get(rel.related_person_id)
    const age = ageYears(person?.date_of_birth)
    const isMinor =
      rel.relationship_type === "child" || (age !== null && age < 18)
    const relatedContactId = isMinor
      ? null
      : contactByPerson.get(rel.related_person_id) || null

    await upsertMember(sb, {
      familyId,
      contactId: relatedContactId,
      personId: rel.related_person_id,
      role: mapRole(rel.relationship_type),
    })
    report.counts.membersUpserted += 1
  }

  report.counts.parentsSynced += 1
}

function deriveNameFromKids(relationships, peopleById, parentFullName) {
  const lastNames = []
  for (const rel of relationships || []) {
    if (String(rel.relationship_type || "").toLowerCase() !== "child") continue
    const person = peopleById.get(rel.related_person_id)
    const last = String(person?.last_name || "").trim()
    if (last) lastNames.push(last)
  }
  if (lastNames.length > 0) {
    const counts = new Map()
    for (const last of lastNames) {
      counts.set(last, (counts.get(last) || 0) + 1)
    }
    let best = lastNames[0]
    let bestCount = 0
    for (const [name, count] of counts) {
      if (count > bestCount) {
        best = name
        bestCount = count
      }
    }
    return best
  }
  const parts = String(parentFullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length > 0) return parts[parts.length - 1]
  return "Household"
}

async function main() {
  loadEnvLocal()
  const execute = process.argv.includes("--execute")
  const allParents = process.argv.includes("--all-parents")
  const campParents = process.argv.includes("--camp-parents")
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const report = {
    mode: execute ? "execute" : "dry-run",
    generatedAt: new Date().toISOString(),
    counts: {
      parentsSynced: 0,
      familiesCreated: 0,
      membersUpserted: 0,
    },
    actions: [],
    warnings: [],
  }

  // Probe schema
  const { error: probeError } = await sb
    .from("family_members")
    .select("id, person_id")
    .limit(1)
  if (probeError && /person_id|column/i.test(probeError.message)) {
    throw new Error(
      "Run scripts/196_family_members_person.sql in Supabase before this sync."
    )
  }

  let parentContactIds = []
  if (campParents) {
    const programs = await must(
      "camp programs",
      sb
        .from("programs")
        .select("id")
        .eq("organization_id", ORG_ID)
        .eq("department_id", CAMP_DEPARTMENT_ID)
    )
    const programIds = (programs || []).map((p) => p.id)
    const ids = new Set()
    for (let i = 0; i < programIds.length; i += 50) {
      const chunk = programIds.slice(i, i + 50)
      let from = 0
      for (;;) {
        const { data, error } = await sb
          .from("program_enrollments")
          .select("registrant_contact_id")
          .eq("organization_id", ORG_ID)
          .in("program_id", chunk)
          .not("registrant_contact_id", "is", null)
          .range(from, from + 999)
        if (error) throw new Error(`camp enrollments: ${error.message}`)
        const page = data || []
        for (const row of page) {
          if (row.registrant_contact_id) ids.add(row.registrant_contact_id)
        }
        if (page.length < 1000) break
        from += 1000
      }
    }
    parentContactIds = [...ids]
    console.log(`Camp parents to sync: ${parentContactIds.length}`)
  } else if (allParents) {
    const { data: rels } = await sb
      .from("person_relationships")
      .select("person_id")
      .eq("organization_id", ORG_ID)
    const personIds = [...new Set((rels || []).map((r) => r.person_id))]
    for (let i = 0; i < personIds.length; i += 100) {
      const chunk = personIds.slice(i, i + 100)
      const contacts = await must(
        "contacts",
        sb
          .from("contacts")
          .select("id")
          .eq("organization_id", ORG_ID)
          .in("person_id", chunk)
      )
      parentContactIds.push(...contacts.map((c) => c.id))
    }
  } else {
    const enrollments = await must(
      "enrollments",
      sb
        .from("program_enrollments")
        .select("registrant_contact_id")
        .eq("organization_id", ORG_ID)
        .eq("program_id", PROGRAM_ID)
        .not("registrant_contact_id", "is", null)
    )
    parentContactIds = [
      ...new Set(enrollments.map((e) => e.registrant_contact_id).filter(Boolean)),
    ]
  }

  parentContactIds = [...new Set(parentContactIds)]
  report.actions.push(`Parents to sync: ${parentContactIds.length}`)
  console.log(`Parents to sync: ${parentContactIds.length}`)

  let synced = 0
  for (let i = 0; i < parentContactIds.length; i += 100) {
    const chunk = parentContactIds.slice(i, i + 100)
    const contacts = await must(
      "load parents",
      sb
        .from("contacts")
        .select("id, full_name, person_id")
        .eq("organization_id", ORG_ID)
        .in("id", chunk)
    )
    for (const contact of contacts) {
      await syncParent(sb, contact, execute, report)
      synced += 1
      if (synced % 25 === 0 || synced === parentContactIds.length) {
        console.log(
          `Synced ${synced}/${parentContactIds.length} (${report.counts.familiesCreated} households created)`
        )
      }
    }
  }

  if (!execute) {
    report.actions.push("Dry-run only — re-run with --execute after applying SQL 196.")
  }

  const dir = resolve(root, "scripts/reports")
  mkdirSync(dir, { recursive: true })
  const path = resolve(
    dir,
    `summer-camp-household-sync-${new Date().toISOString().slice(0, 10)}.json`
  )
  writeFileSync(path, JSON.stringify(report, null, 2))
  report.reportPath = path
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

/**
 * Repair duplicate parent people created when linking siblings, then
 * re-link any missing child relationships.
 *
 * Usage:
 *   node scripts/repair-summer-camp-parent-people.mjs
 *   node scripts/repair-summer-camp-parent-people.mjs --execute
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const ORG_ID = "e057e00a-e4e3-4adf-9af5-f465db1894be"
const PROGRAM_ID = "e6436c28-666c-4327-b3c1-4234d2379a42"

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

async function main() {
  loadEnvLocal()
  const execute = process.argv.includes("--execute")
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const report = {
    mode: execute ? "execute" : "dry-run",
    generatedAt: new Date().toISOString(),
    counts: {
      uniqueParents: 0,
      orphanPeopleFound: 0,
      orphanPeopleDeleted: 0,
      relationshipsRepointed: 0,
      relationshipsEnsured: 0,
    },
    actions: [],
    warnings: [],
  }

  const enrollments = await must(
    "enrollments",
    sb
      .from("program_enrollments")
      .select("id, child_person_id, registrant_contact_id, child_name")
      .eq("organization_id", ORG_ID)
      .eq("program_id", PROGRAM_ID)
      .not("child_person_id", "is", null)
      .not("registrant_contact_id", "is", null)
  )

  const parentIds = [
    ...new Set(enrollments.map((row) => row.registrant_contact_id).filter(Boolean)),
  ]
  report.counts.uniqueParents = parentIds.length

  const contacts = new Map()
  for (let i = 0; i < parentIds.length; i += 100) {
    const chunk = parentIds.slice(i, i + 100)
    const rows = await must(
      "contacts",
      sb
        .from("contacts")
        .select("id, full_name, person_id")
        .eq("organization_id", ORG_ID)
        .in("id", chunk)
    )
    for (const row of rows) contacts.set(row.id, row)
  }

  // People created today for parents that are NOT the contact's current person_id
  // are orphans from the sibling bug. Find people linked only via relationships
  // from wrong parent person ids.

  // Build canonical parent person per contact.
  const canonicalParentPerson = new Map()
  for (const contact of contacts.values()) {
    if (contact.person_id) {
      canonicalParentPerson.set(contact.id, contact.person_id)
    }
  }

  // Collect all relationships where related_person is a camp child.
  const childIds = [
    ...new Set(enrollments.map((row) => row.child_person_id).filter(Boolean)),
  ]

  const relationships = []
  for (let i = 0; i < childIds.length; i += 100) {
    const chunk = childIds.slice(i, i + 100)
    const rows = await must(
      "relationships",
      sb
        .from("person_relationships")
        .select("id, person_id, related_person_id, relationship_type")
        .eq("organization_id", ORG_ID)
        .in("related_person_id", chunk)
    )
    relationships.push(...rows)
  }

  // Map child -> registrant contact (from enrollment)
  const childToParentContact = new Map()
  for (const row of enrollments) {
    if (row.child_person_id && row.registrant_contact_id) {
      childToParentContact.set(row.child_person_id, row.registrant_contact_id)
    }
  }

  const orphanParentPeople = new Set()

  for (const rel of relationships) {
    const parentContactId = childToParentContact.get(rel.related_person_id)
    if (!parentContactId) continue
    const canonical = canonicalParentPerson.get(parentContactId)
    if (!canonical) continue

    if (rel.person_id === canonical) {
      report.counts.relationshipsEnsured += 1
      continue
    }

    // Wrong parent person — move relationship to canonical, delete orphan person later.
    orphanParentPeople.add(rel.person_id)
    report.actions.push(
      `Repoint ${rel.related_person_id} from ${rel.person_id} → ${canonical}`
    )

    if (!execute) {
      report.counts.relationshipsRepointed += 1
      continue
    }

    // Ensure canonical relationship exists.
    const { data: existing } = await sb
      .from("person_relationships")
      .select("id")
      .eq("organization_id", ORG_ID)
      .eq("person_id", canonical)
      .eq("related_person_id", rel.related_person_id)
      .maybeSingle()

    if (!existing) {
      const { error } = await sb.from("person_relationships").insert({
        organization_id: ORG_ID,
        person_id: canonical,
        related_person_id: rel.related_person_id,
        relationship_type: rel.relationship_type || "child",
      })
      if (error && !/duplicate|unique/i.test(error.message)) {
        report.warnings.push(error.message)
        continue
      }
    }

    await sb
      .from("person_relationships")
      .delete()
      .eq("id", rel.id)
      .eq("organization_id", ORG_ID)

    report.counts.relationshipsRepointed += 1
  }

  // Also ensure every child has a relationship to canonical parent.
  for (const [childId, parentContactId] of childToParentContact) {
    const canonical = canonicalParentPerson.get(parentContactId)
    if (!canonical) {
      report.warnings.push(
        `Parent contact ${parentContactId} has no person_id for child ${childId}`
      )
      continue
    }

    const { data: existing } = await sb
      .from("person_relationships")
      .select("id")
      .eq("organization_id", ORG_ID)
      .eq("person_id", canonical)
      .eq("related_person_id", childId)
      .maybeSingle()

    if (existing) continue

    report.actions.push(
      `Ensure link child ${childId} under parent person ${canonical}`
    )
    if (!execute) {
      report.counts.relationshipsEnsured += 1
      continue
    }

    const { error } = await sb.from("person_relationships").insert({
      organization_id: ORG_ID,
      person_id: canonical,
      related_person_id: childId,
      relationship_type: "child",
    })
    if (error && !/duplicate|unique/i.test(error.message)) {
      report.warnings.push(error.message)
    } else {
      report.counts.relationshipsEnsured += 1
    }
  }

  report.counts.orphanPeopleFound = orphanParentPeople.size

  // Delete orphan parent people that are not used by any contact.
  for (const personId of orphanParentPeople) {
    const { data: stillContact } = await sb
      .from("contacts")
      .select("id")
      .eq("organization_id", ORG_ID)
      .eq("person_id", personId)
      .maybeSingle()

    if (stillContact) continue

    const { count: relCount } = await sb
      .from("person_relationships")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ORG_ID)
      .or(`person_id.eq.${personId},related_person_id.eq.${personId}`)

    if ((relCount ?? 0) > 0) {
      report.warnings.push(
        `Kept orphan person ${personId} — still has relationships`
      )
      continue
    }

    report.actions.push(`Delete orphan parent person ${personId}`)
    if (!execute) {
      report.counts.orphanPeopleDeleted += 1
      continue
    }

    const { error } = await sb
      .from("people")
      .delete()
      .eq("id", personId)
      .eq("organization_id", ORG_ID)
    if (error) {
      report.warnings.push(`delete ${personId}: ${error.message}`)
    } else {
      report.counts.orphanPeopleDeleted += 1
    }
  }

  if (!execute) {
    report.actions.push("Dry-run only — re-run with --execute to apply.")
  }

  const dir = resolve(root, "scripts/reports")
  mkdirSync(dir, { recursive: true })
  const path = resolve(
    dir,
    `summer-camp-parent-people-repair-${new Date().toISOString().slice(0, 10)}.json`
  )
  writeFileSync(path, JSON.stringify(report, null, 2))
  report.reportPath = path
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

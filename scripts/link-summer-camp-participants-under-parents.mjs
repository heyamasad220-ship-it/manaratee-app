/**
 * Ensure Summer Camp 2026 youth participants appear under parent Contact
 * profiles (person_relationships: parent → child). Minors stay people — no
 * CRM contact.
 *
 * Usage:
 *   node scripts/link-summer-camp-participants-under-parents.mjs
 *   node scripts/link-summer-camp-participants-under-parents.mjs --execute
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

function splitName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return { first: "Child", last: "Participant" }
  if (parts.length === 1) return { first: parts[0], last: "Participant" }
  return { first: parts[0], last: parts.slice(1).join(" ") }
}

async function must(label, promise) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function loadByIds(sb, table, ids, columns) {
  const map = new Map()
  const unique = [...new Set(ids.filter(Boolean))]
  const chunkSize = 100
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const rows = await must(
      `load ${table} ${i}`,
      sb.from(table).select(columns).eq("organization_id", ORG_ID).in("id", chunk)
    )
    for (const row of rows) map.set(row.id, row)
  }
  return map
}

async function ensureParentPerson(sb, contact, report) {
  if (contact.person_id) return contact.person_id

  const { first, last } = splitName(contact.full_name)
  const created = await must(
    `create parent person ${contact.full_name}`,
    sb
      .from("people")
      .insert({
        organization_id: ORG_ID,
        first_name: first,
        last_name: last,
        person_type: "contact",
        email: contact.email || null,
        phone: contact.phone || null,
      })
      .select("id")
      .single()
  )

  await must(
    `link parent contact ${contact.id}`,
    sb
      .from("contacts")
      .update({
        person_id: created.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contact.id)
      .eq("organization_id", ORG_ID)
  )

  report.counts.parentsPersonCreated += 1
  return created.id
}

async function main() {
  loadEnvLocal()
  const execute = process.argv.includes("--execute")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase env in .env.local")

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const report = {
    mode: execute ? "execute" : "dry-run",
    generatedAt: new Date().toISOString(),
    orgId: ORG_ID,
    programId: PROGRAM_ID,
    counts: {
      enrollmentsScanned: 0,
      uniqueChildren: 0,
      alreadyLinked: 0,
      relationshipsCreated: 0,
      childPeopleCreated: 0,
      parentsPersonCreated: 0,
      skippedNoParent: 0,
      skippedAdultSelf: 0,
    },
    actions: [],
    warnings: [],
  }

  const enrollments = await must(
    "load enrollments",
    sb
      .from("program_enrollments")
      .select(
        "id, child_name, child_person_id, participant_contact_id, registrant_contact_id, parent_name, status"
      )
      .eq("organization_id", ORG_ID)
      .eq("program_id", PROGRAM_ID)
  )
  report.counts.enrollmentsScanned = enrollments.length

  const contactIds = enrollments.flatMap((row) => [
    row.registrant_contact_id,
    row.participant_contact_id,
  ])
  const contacts = await loadByIds(
    sb,
    "contacts",
    contactIds,
    "id, full_name, person_id, email, phone"
  )

  const personIds = [
    ...enrollments.map((row) => row.child_person_id),
    ...[...contacts.values()].map((row) => row.person_id),
  ]
  const people = await loadByIds(
    sb,
    "people",
    personIds,
    "id, first_name, last_name"
  )

  // One link plan per child person (or name+parent when no person yet).
  const plans = new Map()

  for (const enrollment of enrollments) {
    const registrantId = enrollment.registrant_contact_id
    const participantId = enrollment.participant_contact_id

    // Adult self-registration — not a child under parent.
    if (registrantId && participantId && registrantId === participantId) {
      report.counts.skippedAdultSelf += 1
      continue
    }

    const registrant = registrantId ? contacts.get(registrantId) : null
    if (!registrant) {
      report.counts.skippedNoParent += 1
      report.warnings.push(
        `Enrollment ${enrollment.id}: missing registrant contact`
      )
      continue
    }

    const childName =
      (enrollment.child_name || "").trim() ||
      (participantId && contacts.get(participantId)?.full_name) ||
      "Child"
    const key =
      enrollment.child_person_id ||
      `${registrantId}::${childName.toLowerCase()}`

    if (!plans.has(key)) {
      plans.set(key, {
        childName,
        childPersonId: enrollment.child_person_id || null,
        registrant,
        enrollmentIds: [],
      })
    }
    plans.get(key).enrollmentIds.push(enrollment.id)
  }

  report.counts.uniqueChildren = plans.size

  for (const plan of plans.values()) {
    const parentLabel = plan.registrant.full_name || plan.registrant.id

    if (!execute) {
      const parentPersonId = plan.registrant.person_id
      let linked = false
      if (parentPersonId && plan.childPersonId) {
        const { data: existing } = await sb
          .from("person_relationships")
          .select("id")
          .eq("organization_id", ORG_ID)
          .eq("person_id", parentPersonId)
          .eq("related_person_id", plan.childPersonId)
          .maybeSingle()
        linked = Boolean(existing)
      }

      if (linked) {
        report.counts.alreadyLinked += 1
        report.actions.push(
          `OK ${plan.childName} already under ${parentLabel}`
        )
      } else {
        report.counts.relationshipsCreated += 1
        report.actions.push(
          `Would link ${plan.childName} under Contact ${parentLabel}`
        )
      }
      continue
    }

    const parentPersonId = await ensureParentPerson(sb, plan.registrant, report)
    // Keep in-memory contact in sync so siblings reuse the same parent person.
    plan.registrant.person_id = parentPersonId
    contacts.set(plan.registrant.id, plan.registrant)

    let childPersonId = plan.childPersonId
    if (childPersonId && !people.has(childPersonId)) {
      childPersonId = null
    }

    if (!childPersonId) {
      const { first, last } = splitName(plan.childName)
      const created = await must(
        `create child person ${plan.childName}`,
        sb
          .from("people")
          .insert({
            organization_id: ORG_ID,
            first_name: first,
            last_name: last,
            person_type: "participant",
            email: null,
            phone: null,
          })
          .select("id")
          .single()
      )
      childPersonId = created.id
      people.set(childPersonId, created)
      report.counts.childPeopleCreated += 1

      // Backfill enrollments that were keyed by name only.
      await must(
        `set child_person_id for ${plan.childName}`,
        sb
          .from("program_enrollments")
          .update({
            child_person_id: childPersonId,
            child_name: plan.childName,
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", ORG_ID)
          .eq("program_id", PROGRAM_ID)
          .in("id", plan.enrollmentIds)
      )
    }

    const { data: existingRel } = await sb
      .from("person_relationships")
      .select("id")
      .eq("organization_id", ORG_ID)
      .eq("person_id", parentPersonId)
      .eq("related_person_id", childPersonId)
      .maybeSingle()

    if (existingRel) {
      report.counts.alreadyLinked += 1
      report.actions.push(`OK ${plan.childName} already under ${parentLabel}`)
      continue
    }

    const { error: relError } = await sb.from("person_relationships").insert({
      organization_id: ORG_ID,
      person_id: parentPersonId,
      related_person_id: childPersonId,
      relationship_type: "child",
    })

    if (relError && !/duplicate|unique/i.test(relError.message)) {
      report.warnings.push(
        `relationship ${parentLabel} → ${plan.childName}: ${relError.message}`
      )
      continue
    }

    report.counts.relationshipsCreated += 1
    report.actions.push(
      `Linked ${plan.childName} under Contact ${parentLabel}`
    )
  }

  if (!execute) {
    report.actions.push("Dry-run only — re-run with --execute to apply.")
  }

  const dir = resolve(root, "scripts/reports")
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const path = resolve(
    dir,
    `summer-camp-link-under-parents-${stamp}.json`
  )
  writeFileSync(path, JSON.stringify(report, null, 2))
  report.reportPath = path
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

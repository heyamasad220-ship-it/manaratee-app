/**
 * Convert Summer Camp (youth) participant contacts into people under the parent
 * Contact — minors must not have CRM contact profiles.
 *
 * For each Summer Camp 2026 enrollment where participant ≠ registrant:
 *   - Ensure a people row + parent→child relationship
 *   - Set enrollment.child_person_id / child_name; clear participant_contact_id
 *   - Remove program_participant role from the minor contact
 *   - Delete the minor contact when it has no other meaningful activity
 *
 * Usage:
 *   node scripts/cleanup-summer-camp-minor-contacts.mjs
 *   node scripts/cleanup-summer-camp-minor-contacts.mjs --execute
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

async function main() {
  loadEnvLocal()
  const execute = process.argv.includes("--execute")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing Supabase env in .env.local")
  }

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
      converted: 0,
      contactsDeleted: 0,
      contactsKept: 0,
      skipped: 0,
    },
    actions: [],
    warnings: [],
  }

  const enrollments = await must(
    "load camp enrollments",
    sb
      .from("program_enrollments")
      .select(
        "id, child_name, child_person_id, participant_contact_id, registrant_contact_id, status"
      )
      .eq("organization_id", ORG_ID)
      .eq("program_id", PROGRAM_ID)
  )

  report.counts.enrollmentsScanned = enrollments.length

  const contactIds = [
    ...new Set(
      enrollments
        .flatMap((row) => [
          row.participant_contact_id,
          row.registrant_contact_id,
        ])
        .filter(Boolean)
    ),
  ]

  const contactById = new Map()
  const chunkSize = 100
  for (let i = 0; i < contactIds.length; i += chunkSize) {
    const chunk = contactIds.slice(i, i + chunkSize)
    const contacts = await must(
      `load contacts ${i}-${i + chunk.length}`,
      sb
        .from("contacts")
        .select("id, full_name, person_id, email, phone")
        .eq("organization_id", ORG_ID)
        .in("id", chunk)
    )
    for (const row of contacts) {
      contactById.set(row.id, row)
    }
  }

  for (const enrollment of enrollments) {
    const participantId = enrollment.participant_contact_id
    const registrantId = enrollment.registrant_contact_id
    if (!participantId) {
      report.counts.skipped += 1
      continue
    }
    if (registrantId && participantId === registrantId) {
      // Adult self-registration — keep contact.
      report.counts.skipped += 1
      continue
    }

    const participant = contactById.get(participantId)
    const registrant = registrantId ? contactById.get(registrantId) : null
    if (!participant) {
      report.warnings.push(`Missing participant contact ${participantId}`)
      report.counts.skipped += 1
      continue
    }

    const childName =
      (enrollment.child_name || "").trim() ||
      (participant.full_name || "").trim() ||
      "Child"
    const { first, last } = splitName(childName)

    report.actions.push(
      `Enrollment ${enrollment.id}: ${childName} → person under parent ${registrant?.full_name || registrantId || "unknown"}`
    )

    if (!execute) {
      report.counts.converted += 1
      continue
    }

    let childPersonId = enrollment.child_person_id || participant.person_id || null

    if (!childPersonId) {
      const created = await must(
        `create person ${childName}`,
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
    }

    if (registrant?.person_id && childPersonId) {
      const { data: existingRel } = await sb
        .from("person_relationships")
        .select("id")
        .eq("organization_id", ORG_ID)
        .eq("person_id", registrant.person_id)
        .eq("related_person_id", childPersonId)
        .maybeSingle()
      if (!existingRel) {
        const { error: relError } = await sb.from("person_relationships").insert({
          organization_id: ORG_ID,
          person_id: registrant.person_id,
          related_person_id: childPersonId,
          relationship_type: "child",
        })
        if (relError && !/duplicate|unique/i.test(relError.message)) {
          report.warnings.push(
            `relationship ${registrant.person_id}→${childPersonId}: ${relError.message}`
          )
        }
      }
    }

    await must(
      `clear participant contact on enrollment ${enrollment.id}`,
      sb
        .from("program_enrollments")
        .update({
          child_person_id: childPersonId,
          child_name: childName,
          participant_contact_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", enrollment.id)
    )

    // Drop Programs affiliation on the minor contact.
    await sb
      .from("contact_roles")
      .delete()
      .eq("organization_id", ORG_ID)
      .eq("contact_id", participantId)
      .eq("role", "program_participant")

    // Unlink contact from person so family panel won't reattach it.
    if (participant.person_id) {
      await sb
        .from("contacts")
        .update({ person_id: null, updated_at: new Date().toISOString() })
        .eq("id", participantId)
        .eq("organization_id", ORG_ID)
    }

    // Delete minor contact if it has no other roles / payments / donor rows.
    const [{ count: roleCount }, { count: paymentCount }, { count: donorCount }] =
      await Promise.all([
        sb
          .from("contact_roles")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", ORG_ID)
          .eq("contact_id", participantId),
        sb
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", ORG_ID)
          .eq("contact_id", participantId),
        sb
          .from("donors")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", ORG_ID)
          .eq("contact_id", participantId),
      ])

    const stillUsed =
      (roleCount ?? 0) > 0 || (paymentCount ?? 0) > 0 || (donorCount ?? 0) > 0

    if (stillUsed) {
      report.counts.contactsKept += 1
      report.warnings.push(
        `Kept contact ${participantId} (${childName}) — still has roles/payments/donor`
      )
    } else {
      // End family_members rows that pointed at this contact.
      await sb
        .from("family_members")
        .update({ end_date: new Date().toISOString().slice(0, 10) })
        .eq("organization_id", ORG_ID)
        .eq("contact_id", participantId)
        .is("end_date", null)

      const { error: deleteError } = await sb
        .from("contacts")
        .delete()
        .eq("id", participantId)
        .eq("organization_id", ORG_ID)
      if (deleteError) {
        report.warnings.push(
          `Could not delete contact ${participantId}: ${deleteError.message}`
        )
        report.counts.contactsKept += 1
      } else {
        report.counts.contactsDeleted += 1
      }
    }

    report.counts.converted += 1
  }

  if (!execute) {
    report.actions.push("Dry-run only — re-run with --execute to apply.")
  }

  const dir = resolve(root, "scripts/reports")
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const path = resolve(dir, `summer-camp-minor-contacts-cleanup-${stamp}.json`)
  writeFileSync(path, JSON.stringify(report, null, 2))
  report.reportPath = path
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

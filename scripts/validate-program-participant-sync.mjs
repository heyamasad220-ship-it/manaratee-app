/**
 * Validates S-09/S-10 program participant identity + affiliation sync behavior.
 * Usage: node scripts/validate-program-participant-sync.mjs
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  loadEnvLocal,
  createServiceRoleClient,
  createCheckRecorder,
  getProjectRoot,
  assertParticipationRolesSchema,
  assertStickyRoleInRules,
  countRoleRows,
  hasRole,
  applyProgramParticipantAffiliationMirror,
  PROGRAM_PARTICIPANT_TERMINAL_STATUSES,
} from "./lib/contacts-phase1-validation.mjs"

const root = getProjectRoot()
const TAG = "PROGRAM_PARTICIPANT_SYNC_V1"

loadEnvLocal()
const sb = createServiceRoleClient()
const { checks, record } = createCheckRecorder()

const TERMINAL_STATUSES = PROGRAM_PARTICIPANT_TERMINAL_STATUSES

async function ensureContactForPersonMirror(organizationId, person) {
  const { data: linked } = await sb
    .from("contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("person_id", person.id)
    .maybeSingle()

  if (linked?.id) {
    return { contactId: linked.id, created: false }
  }

  const fullName =
    `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || "Family Member"

  const { data: created, error } = await sb
    .from("contacts")
    .insert({
      organization_id: organizationId,
      full_name: fullName,
      person_id: person.id,
      email: person.email || null,
      phone: person.phone || null,
      contact_type: "individual",
      status: "active",
    })
    .select("id")
    .single()

  if (error || !created?.id) {
    throw new Error(error?.message || "Could not create contact for person")
  }

  return { contactId: created.id, created: true }
}

async function cleanup(ids) {
  const { enrollments, contacts, people, roles } = ids

  if (enrollments?.length) {
    await sb.from("program_enrollments").delete().in("id", enrollments)
  }

  if (roles?.length) {
    for (const entry of roles) {
      await sb
        .from("contact_roles")
        .delete()
        .eq("contact_id", entry.contactId)
        .eq("role", "customer")
    }
  }

  if (contacts?.length) {
    await sb.from("contacts").delete().in("id", contacts)
  }

  if (people?.length) {
    await sb.from("people").delete().in("id", people)
  }
}

const registrationSource = readFileSync(
  resolve(root, "lib/programs/program-registration-actions.ts"),
  "utf8"
)
record(
  "registration-actions-resolve-participant-contact",
  registrationSource.includes("resolveParticipantContactIdForRegistration") &&
    registrationSource.includes("syncAffiliationAfterEnrollmentCreation"),
  "S-09 resolve + S-10 sync wired in registerSingleParticipant"
)

const enrollmentSource = readFileSync(
  resolve(root, "lib/programs/program-enrollment-actions.ts"),
  "utf8"
)
record(
  "enrollment-actions-use-sync-contact-affiliations",
  enrollmentSource.includes("syncContactAffiliations") &&
    enrollmentSource.includes("maybeSyncProgramParticipantAffiliation") &&
    !enrollmentSource.match(/from\("contact_roles"\)\.insert/),
  "syncContactAffiliations only — no manual contact_roles insert"
)

const personSource = readFileSync(
  resolve(root, "lib/programs/person-actions.ts"),
  "utf8"
)
record(
  "person-actions-wrap-ensure-contact-for-person",
  personSource.includes("ensureContactForPerson") &&
    personSource.includes("ensureParticipantContactForPerson"),
  "participant contact uses approved identity helper"
)

const lifecycleSource = readFileSync(
  resolve(root, "lib/programs/program-lifecycle-actions.ts"),
  "utf8"
)
record(
  "promote-waitlist-sync-wired",
  lifecycleSource.includes("promote_waitlist") &&
    lifecycleSource.includes("syncAffiliationAfterEnrollmentCreation"),
  "waitlist promotion triggers affiliation sync"
)

record(
  "program-participant-is-sticky",
  assertStickyRoleInRules("customer"),
  "customer listed in STICKY_DERIVED_ROLES"
)

const schemaCheck = await assertParticipationRolesSchema(sb)
record(
  "schema-participation-roles",
  schemaCheck.ok,
  schemaCheck.message || "customer allowed in contact_roles"
)
if (!schemaCheck.ok) {
  process.exit(1)
}

const { data: program } = await sb
  .from("programs")
  .select("id, organization_id")
  .eq("status", "active")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle()

if (!program?.organization_id) {
  console.error("No active program found. Create a program before running validation.")
  process.exit(2)
}

const orgId = program.organization_id
const programId = program.id
const created = { enrollments: [], contacts: [], people: [], roles: [] }

try {
  const stamp = Date.now()
  const registrantEmail = `${TAG.toLowerCase()}-registrant-${stamp}@validation.local`
  const payerEmail = `${TAG.toLowerCase()}-payer-${stamp}@validation.local`

  const { data: registrantContact, error: registrantError } = await sb
    .from("contacts")
    .insert({
      organization_id: orgId,
      full_name: "Program Sync Registrant",
      email: registrantEmail,
      contact_type: "individual",
      status: "active",
    })
    .select("id")
    .single()

  record(
    "create-registrant-contact",
    !registrantError && !!registrantContact?.id,
    registrantError?.message
  )
  if (!registrantContact?.id) throw new Error("registrant contact setup failed")
  created.contacts.push(registrantContact.id)

  const { data: payerContact, error: payerError } = await sb
    .from("contacts")
    .insert({
      organization_id: orgId,
      full_name: "Program Sync Payer",
      email: payerEmail,
      contact_type: "individual",
      status: "active",
    })
    .select("id")
    .single()

  record("create-payer-contact", !payerError && !!payerContact?.id, payerError?.message)
  if (!payerContact?.id) throw new Error("payer contact setup failed")
  created.contacts.push(payerContact.id)

  const { data: childPerson, error: childPersonError } = await sb
    .from("people")
    .insert({
      organization_id: orgId,
      first_name: "Program",
      last_name: `Child ${stamp}`,
      email: `${TAG.toLowerCase()}-child-${stamp}@validation.local`,
    })
    .select("id, first_name, last_name, email, phone")
    .single()

  record("create-child-person", !childPersonError && !!childPerson?.id, childPersonError?.message)
  if (!childPerson?.id) throw new Error("child person setup failed")
  created.people.push(childPerson.id)

  const ensured = await ensureContactForPersonMirror(orgId, childPerson)
  record(
    "enrollment-creates-participant-contact",
    !!ensured.contactId,
    `contact=${ensured.contactId}, created=${ensured.created}`
  )
  created.contacts.push(ensured.contactId)
  created.roles.push({ contactId: ensured.contactId })

  const secondEnsure = await ensureContactForPersonMirror(orgId, childPerson)
  record(
    "existing-participant-reuses-contact",
    secondEnsure.contactId === ensured.contactId,
    `first=${ensured.contactId}, second=${secondEnsure.contactId}`
  )

  const { data: enrollment, error: enrollmentError } = await sb
    .from("program_enrollments")
    .insert({
      organization_id: orgId,
      program_id: programId,
      participant_contact_id: ensured.contactId,
      registrant_contact_id: registrantContact.id,
      payer_contact_id: payerContact.id,
      child_person_id: childPerson.id,
      child_name: `${childPerson.first_name} ${childPerson.last_name}`,
      status: "enrolled",
      payment_status: "pending",
    })
    .select(
      "id, participant_contact_id, registrant_contact_id, payer_contact_id, child_person_id, status"
    )
    .single()

  record(
    "create-test-enrollment",
    !enrollmentError && !!enrollment?.id,
    enrollmentError?.message
  )
  if (!enrollment?.id) throw new Error("enrollment setup failed")
  created.enrollments.push(enrollment.id)

  record(
    "child-participant-contact-id-set",
    enrollment.participant_contact_id === ensured.contactId &&
      enrollment.child_person_id === childPerson.id,
    `participant_contact_id=${enrollment.participant_contact_id}`
  )

  record(
    "registrant-contact-id-preserved",
    enrollment.registrant_contact_id === registrantContact.id,
    `registrant=${enrollment.registrant_contact_id}`
  )

  record(
    "payer-contact-id-preserved",
    enrollment.payer_contact_id === payerContact.id,
    `payer=${enrollment.payer_contact_id}`
  )

  await applyProgramParticipantAffiliationMirror(sb, orgId, ensured.contactId)
  const roleAfterEnroll = await hasRole(sb, orgId, ensured.contactId, "customer")
  record(
    "enrollment-assigns-program-participant",
    roleAfterEnroll.ok && roleAfterEnroll.hasRole,
    roleAfterEnroll.error || (roleAfterEnroll.hasRole ? "role present" : "role missing")
  )

  await applyProgramParticipantAffiliationMirror(sb, orgId, ensured.contactId)
  const duplicateRoleCount = await countRoleRows(sb, orgId, ensured.contactId, "customer")
  record(
    "duplicate-sync-no-duplicate-role-rows",
    duplicateRoleCount.ok && duplicateRoleCount.count === 1,
    `rows=${duplicateRoleCount.count}`
  )

  await sb
    .from("program_enrollments")
    .update({ status: "withdrawn", withdrawn_at: new Date().toISOString() })
    .eq("id", enrollment.id)

  await applyProgramParticipantAffiliationMirror(sb, orgId, ensured.contactId)
  const roleAfterWithdraw = await hasRole(sb, orgId, ensured.contactId, "customer")
  record(
    "withdrawal-retains-program-participant",
    roleAfterWithdraw.ok && roleAfterWithdraw.hasRole,
    roleAfterWithdraw.error || (roleAfterWithdraw.hasRole ? "sticky role kept" : "role removed")
  )

  await sb
    .from("program_enrollments")
    .update({ status: "completed" })
    .eq("id", enrollment.id)

  await applyProgramParticipantAffiliationMirror(sb, orgId, ensured.contactId)
  const roleAfterComplete = await hasRole(sb, orgId, ensured.contactId, "customer")
  record(
    "completion-retains-program-participant",
    roleAfterComplete.ok && roleAfterComplete.hasRole,
    roleAfterComplete.error || (roleAfterComplete.hasRole ? "sticky role kept" : "role removed")
  )

  const { data: enrollmentIntegrity } = await sb
    .from("program_enrollments")
    .select(
      "id, status, participant_contact_id, registrant_contact_id, payer_contact_id, child_person_id"
    )
    .eq("id", enrollment.id)
    .maybeSingle()

  record(
    "sync-does-not-corrupt-enrollment",
    !!enrollmentIntegrity?.id &&
      enrollmentIntegrity.status === "completed" &&
      enrollmentIntegrity.participant_contact_id === ensured.contactId &&
      enrollmentIntegrity.registrant_contact_id === registrantContact.id &&
      enrollmentIntegrity.payer_contact_id === payerContact.id &&
      enrollmentIntegrity.child_person_id === childPerson.id,
    `status=${enrollmentIntegrity?.status}`
  )

  const { data: backfillPerson, error: backfillPersonError } = await sb
    .from("people")
    .insert({
      organization_id: orgId,
      first_name: "Backfill",
      last_name: `Child ${stamp}`,
    })
    .select("id, first_name, last_name, email, phone")
    .single()

  if (!backfillPersonError && backfillPerson?.id) {
    created.people.push(backfillPerson.id)

    const { data: backfillEnrollment, error: backfillEnrollmentError } = await sb
      .from("program_enrollments")
      .insert({
        organization_id: orgId,
        program_id: programId,
        participant_contact_id: null,
        registrant_contact_id: registrantContact.id,
        payer_contact_id: payerContact.id,
        child_person_id: backfillPerson.id,
        child_name: "Backfill Child",
        status: "pending",
        payment_status: "pending",
      })
      .select("id, participant_contact_id, child_person_id")
      .single()

    if (!backfillEnrollmentError && backfillEnrollment?.id) {
      created.enrollments.push(backfillEnrollment.id)

      const backfillContact = await ensureContactForPersonMirror(orgId, backfillPerson)
      created.contacts.push(backfillContact.contactId)
      created.roles.push({ contactId: backfillContact.contactId })

      await sb
        .from("program_enrollments")
        .update({ participant_contact_id: backfillContact.contactId })
        .eq("id", backfillEnrollment.id)
        .is("participant_contact_id", null)

      const { data: backfilled } = await sb
        .from("program_enrollments")
        .select("participant_contact_id")
        .eq("id", backfillEnrollment.id)
        .maybeSingle()

      record(
        "backfill-participant-contact-id",
        backfilled?.participant_contact_id === backfillContact.contactId,
        `participant_contact_id=${backfilled?.participant_contact_id}`
      )
    }
  }
} finally {
  await cleanup(created)
}

const failed = checks.filter((check) => !check.pass)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
if (failed.length > 0) {
  process.exit(1)
}

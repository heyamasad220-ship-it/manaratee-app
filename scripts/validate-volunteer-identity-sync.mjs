/**
 * Validates S-11 volunteer identity + affiliation sync behavior.
 * Usage: node scripts/validate-volunteer-identity-sync.mjs
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  loadEnvLocal,
  createServiceRoleClient,
  createCheckRecorder,
  getProjectRoot,
  assertStickyRoleInRules,
  countRoleRows,
  hasRole,
  applyVolunteerAffiliationMirror,
} from "./lib/contacts-phase1-validation.mjs"

const root = getProjectRoot()
const TAG = "VOLUNTEER_IDENTITY_SYNC_V1"

loadEnvLocal()
const sb = createServiceRoleClient()
const { checks, record } = createCheckRecorder()

async function ensureVolunteerRecordMirror(organizationId, contact) {
  const { data: existing } = await sb
    .from("volunteers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contact.id)
    .maybeSingle()

  if (existing?.id) {
    return { volunteerId: existing.id, created: false }
  }

  const nameParts = (contact.full_name || "Volunteer Contact").trim().split(/\s+/)
  const firstName = nameParts[0] || "Volunteer"
  const lastName = nameParts.slice(1).join(" ") || "Contact"

  const { data: created, error } = await sb
    .from("volunteers")
    .insert({
      organization_id: organizationId,
      contact_id: contact.id,
      first_name: firstName,
      last_name: lastName,
      email: contact.email,
      phone: contact.phone,
      status: "active",
      join_date: new Date().toISOString().slice(0, 10),
      skills: [],
      availability: [],
    })
    .select("id")
    .single()

  if (error || !created?.id) {
    throw new Error(error?.message || "Could not create volunteer record")
  }

  return { volunteerId: created.id, created: true }
}

async function cleanup(ids) {
  const { volunteers, contacts, memberships, donors } = ids

  if (volunteers?.length) {
    await sb.from("volunteer_sign_ups").delete().in("volunteer_id", volunteers)
    await sb.from("volunteer_history").delete().in("volunteer_id", volunteers)
    await sb.from("volunteers").delete().in("id", volunteers)
  }

  if (contacts?.length) {
    await sb.from("contact_roles").delete().in("contact_id", contacts)
    await sb.from("contacts").delete().in("id", contacts)
  }

  if (memberships?.length) {
    await sb.from("memberships").delete().in("id", memberships)
  }

  if (donors?.length) {
    await sb.from("donors").delete().in("id", donors)
  }
}

const volunteerActionsSource = readFileSync(
  resolve(root, "lib/volunteers/volunteer-actions.ts"),
  "utf8"
)

record(
  "ensure-volunteer-uses-sync-contact-affiliations",
  volunteerActionsSource.includes("syncContactAffiliations") &&
    /ensureVolunteerForContact[\s\S]*syncContactAffiliations/.test(
      volunteerActionsSource
    ),
  "ensureVolunteerForContact calls syncContactAffiliations"
)

record(
  "ensure-volunteer-no-add-roles-to-contact",
  !volunteerActionsSource.includes("addRolesToContact"),
  "removed broken addRolesToContact reference"
)

record(
  "ensure-volunteer-no-manual-contact-roles-insert",
  !volunteerActionsSource.match(/from\("contact_roles"\)\.insert/),
  "volunteer-actions does not insert contact_roles directly"
)

record(
  "create-volunteer-uses-sync-contact-affiliations",
  /createVolunteer[\s\S]*syncContactAffiliations/.test(volunteerActionsSource),
  "createVolunteer path uses syncContactAffiliations"
)

record(
  "create-volunteer-prevents-duplicate-volunteer",
  /existingVolunteer[\s\S]*syncContactAffiliations/.test(volunteerActionsSource),
  "duplicate volunteer short-circuits with sync"
)

record(
  "volunteer-is-sticky",
  assertStickyRoleInRules("volunteer"),
  "volunteer listed in STICKY_DERIVED_ROLES"
)

const { data: orgRow } = await sb
  .from("organizations")
  .select("id")
  .limit(1)
  .maybeSingle()

if (!orgRow?.id) {
  console.error("No organization found.")
  process.exit(2)
}

const orgId = orgRow.id
const created = { volunteers: [], contacts: [], memberships: [], donors: [] }

try {
  const stamp = Date.now()
  const email = `${TAG.toLowerCase()}-${stamp}@validation.local`

  const { data: contactA, error: contactAError } = await sb
    .from("contacts")
    .insert({
      organization_id: orgId,
      full_name: "Volunteer Identity Validator",
      email,
      contact_type: "individual",
      status: "active",
    })
    .select("id, full_name, email, phone")
    .single()

  record("create-test-contact", !contactAError && !!contactA?.id, contactAError?.message)
  if (!contactA?.id) throw new Error("contact setup failed")
  created.contacts.push(contactA.id)

  const firstVolunteer = await ensureVolunteerRecordMirror(orgId, contactA)
  record(
    "volunteer-record-created",
    !!firstVolunteer.volunteerId,
    `volunteer=${firstVolunteer.volunteerId}, created=${firstVolunteer.created}`
  )
  created.volunteers.push(firstVolunteer.volunteerId)

  await applyVolunteerAffiliationMirror(sb, orgId, contactA.id)
  const roleAfterCreate = await hasRole(sb, orgId, contactA.id, "volunteer")
  record(
    "volunteer-role-assigned",
    roleAfterCreate.ok && roleAfterCreate.hasRole,
    roleAfterCreate.error || (roleAfterCreate.hasRole ? "role present" : "role missing")
  )

  const secondVolunteer = await ensureVolunteerRecordMirror(orgId, contactA)
  const { count: volunteerCount } = await sb
    .from("volunteers")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("contact_id", contactA.id)

  record(
    "duplicate-volunteer-prevented",
    secondVolunteer.volunteerId === firstVolunteer.volunteerId &&
      (volunteerCount ?? 0) === 1,
    `volunteer=${secondVolunteer.volunteerId}, count=${volunteerCount ?? 0}`
  )

  await applyVolunteerAffiliationMirror(sb, orgId, contactA.id)
  const duplicateRoleCount = await countRoleRows(sb, orgId, contactA.id, "volunteer")
  record(
    "duplicate-sync-no-duplicate-role-rows",
    duplicateRoleCount.ok && duplicateRoleCount.count === 1,
    `rows=${duplicateRoleCount.count}`
  )

  const reuseEmail = `${TAG.toLowerCase()}-reuse-${stamp}@validation.local`
  const { data: existingByEmail } = await sb
    .from("contacts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("email", reuseEmail)
    .limit(1)
    .maybeSingle()

  const { data: reuseContact, error: reuseContactError } = await sb
    .from("contacts")
    .insert({
      organization_id: orgId,
      full_name: "Reuse Volunteer Contact",
      email: reuseEmail,
      contact_type: "individual",
      status: "active",
    })
    .select("id, full_name, email, phone")
    .single()

  record(
    "volunteer-reuses-canonical-contact",
    !reuseContactError &&
      !!reuseContact?.id &&
      (!existingByEmail?.id || existingByEmail.id === reuseContact.id),
    `contact=${reuseContact?.id}`
  )
  if (!reuseContact?.id) throw new Error("reuse contact setup failed")
  created.contacts.push(reuseContact.id)

  const { error: donorRoleError } = await sb.from("contact_roles").insert({
    organization_id: orgId,
    contact_id: reuseContact.id,
    role: "donor",
    is_manual: false,
  })

  record(
    "seed-donor-role",
    !donorRoleError,
    donorRoleError?.message || "donor role seeded on contact"
  )

  const reuseVolunteer = await ensureVolunteerRecordMirror(orgId, reuseContact)
  created.volunteers.push(reuseVolunteer.volunteerId)
  await applyVolunteerAffiliationMirror(sb, orgId, reuseContact.id)

  const donorRole = await hasRole(sb, orgId, reuseContact.id, "donor")
  const volunteerRole = await hasRole(sb, orgId, reuseContact.id, "volunteer")
  record(
    "donor-role-remains-intact",
    donorRole.ok && donorRole.hasRole && volunteerRole.ok && volunteerRole.hasRole,
    `donor=${donorRole.hasRole}, volunteer=${volunteerRole.hasRole}`
  )

  const { data: memberContact, error: memberContactError } = await sb
    .from("contacts")
    .insert({
      organization_id: orgId,
      full_name: "Member Volunteer Contact",
      email: `${TAG.toLowerCase()}-member-${stamp}@validation.local`,
      contact_type: "individual",
      status: "active",
    })
    .select("id, full_name, email, phone")
    .single()

  record(
    "create-member-volunteer-contact",
    !memberContactError && !!memberContact?.id,
    memberContactError?.message
  )
  if (!memberContact?.id) throw new Error("member contact setup failed")
  created.contacts.push(memberContact.id)

  const { error: memberRoleError } = await sb.from("contact_roles").insert({
    organization_id: orgId,
    contact_id: memberContact.id,
    role: "member",
    is_manual: false,
  })

  record(
    "seed-member-role",
    !memberRoleError,
    memberRoleError?.message || "member role seeded on contact"
  )

  const memberVolunteer = await ensureVolunteerRecordMirror(orgId, memberContact)
  created.volunteers.push(memberVolunteer.volunteerId)
  await applyVolunteerAffiliationMirror(sb, orgId, memberContact.id)

  const memberRole = await hasRole(sb, orgId, memberContact.id, "member")
  const memberVolunteerRole = await hasRole(sb, orgId, memberContact.id, "volunteer")
  record(
    "member-role-unchanged-after-volunteer-sync",
    memberRole.ok && memberRole.hasRole && memberVolunteerRole.ok && memberVolunteerRole.hasRole,
    `member=${memberRole.hasRole}, volunteer=${memberVolunteerRole.hasRole}`
  )
} finally {
  await cleanup(created)
}

const failed = checks.filter((check) => !check.pass)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
if (failed.length > 0) {
  process.exit(1)
}

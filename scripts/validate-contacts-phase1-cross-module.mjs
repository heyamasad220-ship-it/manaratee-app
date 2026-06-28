/**
 * Cross-module Contacts Phase 1 validation — role accumulation on a single contact.
 * Usage: node scripts/validate-contacts-phase1-cross-module.mjs
 */
import {
  loadEnvLocal,
  createServiceRoleClient,
  createCheckRecorder,
  hasRole,
  countRoleRows,
  upsertDerivedRoleMirror,
  applyDonorAffiliationMirror,
  applyVolunteerAffiliationMirror,
  applyProgramParticipantAffiliationMirror,
  applyEventAttendeeAffiliationMirror,
  PHASE1_PARTICIPATION_ROLES,
} from "./lib/contacts-phase1-validation.mjs"

const TAG = "CONTACTS_PHASE1_CROSS_MODULE_V1"

loadEnvLocal()
const sb = createServiceRoleClient()
const { checks, record } = createCheckRecorder("cross-module")

function generateOrderNumber() {
  return `P1${Date.now().toString().slice(-8)}`
}

async function cleanup(ids) {
  const {
    enrollments,
    orders,
    volunteers,
    contacts,
    donors,
    payments,
    ticketTypes,
  } = ids

  if (orders?.length) {
    await sb.from("tickets").delete().in("ticket_order_id", orders)
    await sb.from("ticket_orders").delete().in("id", orders)
  }

  if (enrollments?.length) {
    await sb.from("program_enrollments").delete().in("id", enrollments)
  }

  if (volunteers?.length) {
    await sb.from("volunteer_sign_ups").delete().in("volunteer_id", volunteers)
    await sb.from("volunteer_history").delete().in("volunteer_id", volunteers)
    await sb.from("volunteers").delete().in("id", volunteers)
  }

  if (payments?.length) {
    await sb.from("payments").delete().in("id", payments)
  }

  if (donors?.length) {
    await sb.from("donors").delete().in("id", donors)
  }

  if (contacts?.length) {
    await sb.from("contact_roles").delete().in("contact_id", contacts)
    await sb.from("contacts").delete().in("id", contacts)
  }

  if (ticketTypes?.length) {
    for (const typeId of ticketTypes) {
      const { data: row } = await sb
        .from("event_ticket_types")
        .select("quantity_sold")
        .eq("id", typeId)
        .maybeSingle()
      if (row) {
        await sb
          .from("event_ticket_types")
          .update({ quantity_sold: Math.max(Number(row.quantity_sold || 0) - 1, 0) })
          .eq("id", typeId)
      }
    }
  }
}

const { data: ticketedEvent } = await sb
  .from("internal_events")
  .select("id, organization_id")
  .eq("requires_ticketing", true)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle()

const { data: initialProgram } = await sb
  .from("programs")
  .select("id, organization_id")
  .eq("status", "active")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle()

let orgId = ticketedEvent?.organization_id || initialProgram?.organization_id
if (!orgId) {
  const { data: orgRow } = await sb.from("organizations").select("id").limit(1).maybeSingle()
  orgId = orgRow?.id
}

if (!orgId) {
  console.error("No organization found for cross-module validation.")
  process.exit(2)
}
const stamp = Date.now()
const email = `${TAG.toLowerCase()}-${stamp}@validation.local`
const created = {
  contacts: [],
  donors: [],
  payments: [],
  volunteers: [],
  enrollments: [],
  orders: [],
  ticketTypes: [],
}

try {
  const { data: contact, error: contactError } = await sb
    .from("contacts")
    .insert({
      organization_id: orgId,
      full_name: "Phase1 Cross Module Contact",
      email,
      contact_type: "individual",
      status: "active",
    })
    .select("id, full_name, email, phone")
    .single()

  record("create-canonical-contact", !contactError && !!contact?.id, contactError?.message)
  if (!contact?.id) throw new Error("contact setup failed")
  created.contacts.push(contact.id)

  const { data: donor, error: donorError } = await sb
    .from("donors")
    .insert({
      organization_id: orgId,
      contact_id: contact.id,
      full_name: contact.full_name,
      email: contact.email,
      donor_type: "individual",
      status: "active",
    })
    .select("id")
    .single()

  record("seed-donor-extension", !donorError && !!donor?.id, donorError?.message)
  if (donor?.id) created.donors.push(donor.id)

  const paymentDate = new Date().toISOString().slice(0, 10)
  const { data: payment, error: paymentError } = await sb
    .from("payments")
    .insert({
      organization_id: orgId,
      donor_id: donor?.id,
      contact_id: contact.id,
      amount: 5,
      payment_date: `${paymentDate}T12:00:00`,
      source: "cash",
      source_type: "validation",
      status: "unallocated",
      is_verified: false,
      memo: TAG,
    })
    .select("id")
    .single()

  record("seed-donor-payment", !paymentError && !!payment?.id, paymentError?.message)
  if (payment?.id) created.payments.push(payment.id)

  await applyDonorAffiliationMirror(sb, orgId, contact.id)
  const donorRole = await hasRole(sb, orgId, contact.id, "donor")
  record(
    "donor-role-assigned",
    donorRole.ok && donorRole.hasRole,
    donorRole.error || (donorRole.hasRole ? "donor present" : "donor missing")
  )

  const nameParts = (contact.full_name || "Cross Module").split(/\s+/)
  const { data: volunteer, error: volunteerError } = await sb
    .from("volunteers")
    .insert({
      organization_id: orgId,
      contact_id: contact.id,
      first_name: nameParts[0] || "Cross",
      last_name: nameParts.slice(1).join(" ") || "Module",
      email: contact.email,
      status: "active",
      join_date: new Date().toISOString().slice(0, 10),
      skills: [],
      availability: [],
    })
    .select("id")
    .single()

  record("volunteer-record-created", !volunteerError && !!volunteer?.id, volunteerError?.message)
  if (volunteer?.id) created.volunteers.push(volunteer.id)

  await applyVolunteerAffiliationMirror(sb, orgId, contact.id)
  const volunteerRole = await hasRole(sb, orgId, contact.id, "volunteer")
  record(
    "donor-to-volunteer-accumulation",
    donorRole.hasRole && volunteerRole.ok && volunteerRole.hasRole,
    `donor=${donorRole.hasRole}, volunteer=${volunteerRole.hasRole}`
  )

  let programForEnrollment = initialProgram?.organization_id === orgId ? initialProgram : null
  if (!programForEnrollment?.id) {
    const { data: activeProgramInOrg } = await sb
      .from("programs")
      .select("id")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    programForEnrollment = activeProgramInOrg
  }

  if (!programForEnrollment?.id) {
    const { data: anyProgramInOrg } = await sb
      .from("programs")
      .select("id")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    programForEnrollment = anyProgramInOrg
  }

  if (!programForEnrollment?.id) {
    record("program-enrollment-seeded", false, "no program found for organization")
  } else {
    const { data: enrollment, error: enrollmentError } = await sb
      .from("program_enrollments")
      .insert({
        organization_id: orgId,
        program_id: programForEnrollment.id,
        participant_contact_id: contact.id,
        registrant_contact_id: contact.id,
        payer_contact_id: contact.id,
        child_name: contact.full_name,
        status: "enrolled",
        payment_status: "pending",
      })
      .select("id")
      .single()

    record(
      "program-enrollment-seeded",
      !enrollmentError && !!enrollment?.id,
      enrollmentError?.message
    )
    if (enrollment?.id) created.enrollments.push(enrollment.id)

    await applyProgramParticipantAffiliationMirror(sb, orgId, contact.id)
    const programRole = await hasRole(sb, orgId, contact.id, "customer")
    record(
      "donor-to-program-participant-accumulation",
      donorRole.hasRole && programRole.ok && programRole.hasRole,
      `donor=${donorRole.hasRole}, customer=${programRole.hasRole}`
    )
  }

  let ticketEventId = null
  let ticketType = null

  const { data: eventInOrg } = await sb
    .from("internal_events")
    .select("id")
    .eq("organization_id", orgId)
    .eq("requires_ticketing", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (eventInOrg?.id) {
    const ticketTypeResult = await sb
      .from("event_ticket_types")
      .select("id")
      .eq("organization_id", orgId)
      .eq("internal_event_id", eventInOrg.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()
    if (ticketTypeResult.data?.id) {
      ticketEventId = eventInOrg.id
      ticketType = ticketTypeResult.data
    }
  }

  if (!ticketEventId || !ticketType?.id) {
    const { data: fallbackEvent } = await sb
      .from("internal_events")
      .select("id, organization_id")
      .eq("requires_ticketing", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fallbackEvent?.id && fallbackEvent.organization_id === orgId) {
      const ticketTypeResult = await sb
        .from("event_ticket_types")
        .select("id")
        .eq("internal_event_id", fallbackEvent.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()
      if (ticketTypeResult.data?.id) {
        ticketEventId = fallbackEvent.id
        ticketType = ticketTypeResult.data
      }
    }
  }

  if (!ticketEventId || !ticketType?.id) {
    record("ticket-order-seeded", false, "no ticketed event or ticket type found for organization")
  } else {
    created.ticketTypes.push(ticketType.id)

    const { data: order, error: orderError } = await sb
      .from("ticket_orders")
      .insert({
        organization_id: orgId,
        internal_event_id: ticketEventId,
        contact_id: contact.id,
        order_number: generateOrderNumber(),
        status: "completed",
        subtotal_cents: 1000,
        discount_cents: 0,
        total_cents: 1000,
        currency: "USD",
        purchaser_name: contact.full_name,
        purchaser_email: email,
        metadata: { validation_tag: TAG },
      })
      .select("id")
      .single()

    record("ticket-order-seeded", !orderError && !!order?.id, orderError?.message)
    if (order?.id) created.orders.push(order.id)

    await applyEventAttendeeAffiliationMirror(sb, orgId, contact.id)
    const attendeeRole = await hasRole(sb, orgId, contact.id, "customer")
    record(
      "donor-to-event-attendee-accumulation",
      donorRole.hasRole && attendeeRole.ok && attendeeRole.hasRole,
      `donor=${donorRole.hasRole}, customer=${attendeeRole.hasRole}`
    )
    record(
      "volunteer-to-event-attendee-accumulation",
      volunteerRole.hasRole && attendeeRole.ok && attendeeRole.hasRole,
      `volunteer=${volunteerRole.hasRole}, customer=${attendeeRole.hasRole}`
    )
  }

  const rolePresence = {}
  for (const role of PHASE1_PARTICIPATION_ROLES) {
    const result = await hasRole(sb, orgId, contact.id, role)
    rolePresence[role] = result.hasRole
  }

  record(
    "all-participation-roles-on-single-contact",
    PHASE1_PARTICIPATION_ROLES.every((role) => rolePresence[role]),
    JSON.stringify(rolePresence)
  )

  for (const role of PHASE1_PARTICIPATION_ROLES) {
    if (role === "donor") {
      await applyDonorAffiliationMirror(sb, orgId, contact.id)
    } else if (role === "volunteer") {
      await applyVolunteerAffiliationMirror(sb, orgId, contact.id)
    } else if (role === "customer") {
      await applyProgramParticipantAffiliationMirror(sb, orgId, contact.id)
      await applyEventAttendeeAffiliationMirror(sb, orgId, contact.id)
    }
  }

  const duplicateCounts = {}
  let duplicateOk = true
  for (const role of PHASE1_PARTICIPATION_ROLES) {
    const counted = await countRoleRows(sb, orgId, contact.id, role)
    duplicateCounts[role] = counted.count
    if (counted.count !== 1) duplicateOk = false
  }

  record(
    "duplicate-sync-idempotent-across-roles",
    duplicateOk,
    JSON.stringify(duplicateCounts)
  )

  const { data: memberContact, error: memberContactError } = await sb
    .from("contacts")
    .insert({
      organization_id: orgId,
      full_name: "Phase1 Member Control",
      email: `${TAG.toLowerCase()}-member-${stamp}@validation.local`,
      contact_type: "individual",
      status: "active",
    })
    .select("id")
    .single()

  if (!memberContactError && memberContact?.id) {
    created.contacts.push(memberContact.id)
    await upsertDerivedRoleMirror(sb, orgId, memberContact.id, "member")
    await applyVolunteerAffiliationMirror(sb, orgId, memberContact.id)

    const memberBefore = await hasRole(sb, orgId, memberContact.id, "member")
    record(
      "member-role-baseline",
      memberBefore.ok && memberBefore.hasRole,
      memberBefore.error || "member seeded"
    )
  } else {
    record("member-role-baseline", false, memberContactError?.message)
  }
} finally {
  await cleanup(created)
}

const failed = checks.filter((check) => !check.pass)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
if (failed.length > 0) {
  process.exit(1)
}

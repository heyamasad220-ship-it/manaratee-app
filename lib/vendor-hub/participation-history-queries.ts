import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { resolveParticipantDisplayName } from "@/lib/vendor-hub/contact-centric-model"

export type ParticipationHistoryRow = {
  id: string
  contactId: string | null
  contactName: string
  eventId: string | null
  eventName: string
  eventDate: string | null
  activityType: "application" | "booth_assignment" | "payment" | "evaluation"
  status: string | null
  amount: number | null
  occurredAt: string | null
  rating: string | null
  wouldInviteAgain: boolean | null
  evaluationNotes: string | null
}

export async function getParticipationHistory(
  contactIdFilter?: string | null
): Promise<ParticipationHistoryRow[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return []
  }

  const supabase = await createClient()
  const rows: ParticipationHistoryRow[] = []

  let applicationsQuery = supabase
    .from("applications")
    .select(
      `
      id,
      contact_id,
      status,
      submitted_at,
      created_at,
      contacts:contact_id (
        id,
        first_name,
        last_name,
        organization_name,
        company_name
      )
    `
    )
    .eq("organization_id", organizationId)
    .eq("module_owner", "vendor_hub")
    .eq("application_type", "vendor")
    .order("created_at", { ascending: false })
    .limit(100)

  if (contactIdFilter) {
    applicationsQuery = applicationsQuery.eq("contact_id", contactIdFilter)
  }

  const { data: applications } = await applicationsQuery

  for (const app of applications || []) {
    const rawContact = app.contacts
    const contact = (Array.isArray(rawContact) ? rawContact[0] : rawContact) as {
      id: string
      first_name: string | null
      last_name: string | null
      organization_name: string | null
      company_name: string | null
    } | null

    rows.push({
      id: `app-${app.id}`,
      contactId: app.contact_id,
      contactName: resolveParticipantDisplayName({ contact }),
      eventId: null,
      eventName: "Organization vendor application",
      eventDate: null,
      activityType: "application",
      status: app.status,
      amount: null,
      occurredAt: app.submitted_at || app.created_at,
      rating: null,
      wouldInviteAgain: null,
      evaluationNotes: null,
    })
  }

  const { data: events } = await supabase.from("vendor_hub_events").select("id, name, event_date")

  const eventById = new Map((events || []).map((event) => [event.id, event]))

  const assignmentSelect = `
    id,
    event_id,
    contact_id,
    fee_amount,
    status,
    created_at,
    contacts:contact_id (
      id,
      first_name,
      last_name,
      organization_name,
      company_name
    ),
    vendor_hub_vendors (
      id,
      business_name,
      contact_name,
      contact_id
    )
  `

  let assignmentsResult = await supabase
    .from("vendor_hub_booth_assignments")
    .select(assignmentSelect)
    .order("created_at", { ascending: false })
    .limit(100)

  if (assignmentsResult.error) {
    assignmentsResult = await supabase
      .from("vendor_hub_booth_assignments")
      .select(
        `
        id,
        event_id,
        contact_id,
        fee_amount,
        status,
        created_at,
        vendor_hub_vendors (
          id,
          business_name,
          contact_name,
          contact_id
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(100)
  }

  for (const assignment of assignmentsResult.data || []) {
    const rawContact = assignment.contacts
    const contact = (Array.isArray(rawContact) ? rawContact[0] : rawContact) as {
      id: string
      first_name: string | null
      last_name: string | null
      organization_name: string | null
      company_name: string | null
    } | null

    const legacyVendor = assignment.vendor_hub_vendors as {
      business_name: string | null
      contact_name: string | null
      contact_id: string | null
    } | null

    const contactId =
      assignment.contact_id ?? contact?.id ?? legacyVendor?.contact_id ?? null

    if (contactIdFilter && contactId !== contactIdFilter) {
      continue
    }

    const event = assignment.event_id ? eventById.get(assignment.event_id) : null

    rows.push({
      id: `assign-${assignment.id}`,
      contactId,
      contactName: resolveParticipantDisplayName({ contact, legacyVendor }),
      eventId: assignment.event_id,
      eventName: event?.name ?? "Bazaar event",
      eventDate: event?.event_date ?? null,
      activityType: "booth_assignment",
      status: assignment.status,
      amount: assignment.fee_amount ? Number(assignment.fee_amount) : null,
      occurredAt: assignment.created_at,
      rating: null,
      wouldInviteAgain: null,
      evaluationNotes: null,
    })
  }

  const { data: payments } = await supabase
    .from("vendor_hub_payments")
    .select("id, event_id, contact_id, amount, payment_type, payment_date, created_at")
    .order("payment_date", { ascending: false })
    .limit(100)

  for (const payment of payments || []) {
    if (contactIdFilter && payment.contact_id !== contactIdFilter) {
      continue
    }

    const event = payment.event_id ? eventById.get(payment.event_id) : null

    rows.push({
      id: `pay-${payment.id}`,
      contactId: payment.contact_id,
      contactName: payment.contact_id ? "Vendor" : "Unknown vendor",
      eventId: payment.event_id,
      eventName: event?.name ?? "Bazaar event",
      eventDate: event?.event_date ?? null,
      activityType: "payment",
      status: payment.payment_type,
      amount: Number(payment.amount),
      occurredAt: payment.payment_date || payment.created_at,
      rating: null,
      wouldInviteAgain: null,
      evaluationNotes: null,
    })
  }

  const { data: evaluations, error: evaluationsError } = await supabase
    .from("vendor_hub_participation_evaluations")
    .select(
      `
      id,
      contact_id,
      vendor_hub_event_id,
      rating,
      would_invite_again,
      notes,
      reviewed_at,
      contacts:contact_id (
        id,
        first_name,
        last_name,
        organization_name,
        company_name
      )
    `
    )
    .eq("organization_id", organizationId)
    .order("reviewed_at", { ascending: false })
    .limit(100)

  if (!evaluationsError) {
    for (const evaluation of evaluations || []) {
      if (contactIdFilter && evaluation.contact_id !== contactIdFilter) {
        continue
      }

      const rawContact = evaluation.contacts
      const contact = (Array.isArray(rawContact) ? rawContact[0] : rawContact) as {
        id: string
        first_name: string | null
        last_name: string | null
        organization_name: string | null
        company_name: string | null
      } | null

      const event = evaluation.vendor_hub_event_id
        ? eventById.get(evaluation.vendor_hub_event_id)
        : null

      rows.push({
        id: `eval-${evaluation.id}`,
        contactId: evaluation.contact_id,
        contactName: resolveParticipantDisplayName({ contact }),
        eventId: evaluation.vendor_hub_event_id,
        eventName: event?.name ?? "Bazaar event",
        eventDate: event?.event_date ?? null,
        activityType: "evaluation",
        status: evaluation.rating,
        amount: null,
        occurredAt: evaluation.reviewed_at,
        rating: evaluation.rating,
        wouldInviteAgain:
          evaluation.would_invite_again === null ||
          evaluation.would_invite_again === undefined
            ? null
            : Boolean(evaluation.would_invite_again),
        evaluationNotes: evaluation.notes,
      })
    }
  }

  rows.sort((a, b) => {
    const aTime = a.occurredAt ? new Date(a.occurredAt).getTime() : 0
    const bTime = b.occurredAt ? new Date(b.occurredAt).getTime() : 0
    return bTime - aTime
  })

  return rows
}

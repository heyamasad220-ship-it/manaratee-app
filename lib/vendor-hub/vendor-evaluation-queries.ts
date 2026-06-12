import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { resolveParticipantDisplayName } from "@/lib/vendor-hub/contact-centric-model"
import type {
  VendorContactEvaluationRow,
  VendorEventEvaluationSummary,
  VendorParticipationEvaluation,
  VendorParticipationRating,
} from "@/lib/vendor-hub/vendor-evaluation-types"

const EVALUABLE_ASSIGNMENT_STATUSES = [
  "reserved",
  "confirmed",
  "assigned",
  "checked_in",
] as const

function mapEvaluationRow(row: Record<string, unknown>): VendorParticipationEvaluation {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    vendorHubEventId: row.vendor_hub_event_id as string,
    contactId: row.contact_id as string,
    boothAssignmentId: (row.booth_assignment_id as string | null) ?? null,
    rating: row.rating as VendorParticipationRating,
    wouldInviteAgain:
      row.would_invite_again === null || row.would_invite_again === undefined
        ? null
        : Boolean(row.would_invite_again),
    notes: (row.notes as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
  }
}

export async function getEventVendorEvaluations(
  eventId: string,
  organizationId: string
): Promise<VendorEventEvaluationSummary> {
  const supabase = await createClient()

  const { data: assignments, error: assignmentsError } = await supabase
    .from("vendor_hub_booth_assignments")
    .select("id, contact_id, booth_id, status")
    .eq("event_id", eventId)
    .not("contact_id", "is", null)
    .in("status", [...EVALUABLE_ASSIGNMENT_STATUSES])
    .order("created_at", { ascending: true })

  if (assignmentsError) {
    console.error("getEventVendorEvaluations assignments:", assignmentsError)
    return { participantsTotal: 0, evaluatedCount: 0, pendingCount: 0, rows: [] }
  }

  const participantAssignments = assignments ?? []
  if (participantAssignments.length === 0) {
    return { participantsTotal: 0, evaluatedCount: 0, pendingCount: 0, rows: [] }
  }

  const contactIds = [...new Set(participantAssignments.map((row) => row.contact_id as string))]
  const boothIds = [
    ...new Set(
      participantAssignments.map((row) => row.booth_id).filter(Boolean) as string[]
    ),
  ]

  const [evaluationsResult, contactsResult, boothsResult] = await Promise.all([
    supabase
      .from("vendor_hub_participation_evaluations")
      .select("*")
      .eq("vendor_hub_event_id", eventId)
      .eq("organization_id", organizationId),
    supabase
      .from("contacts")
      .select("id, first_name, last_name, email, organization_name, company_name")
      .in("id", contactIds),
    boothIds.length > 0
      ? supabase.from("vendor_hub_booths").select("id, number").in("id", boothIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (evaluationsResult.error) {
    console.error("getEventVendorEvaluations evaluations:", evaluationsResult.error)
  }

  const evaluationByContact = new Map(
    (evaluationsResult.data ?? []).map((row) => [
      row.contact_id as string,
      mapEvaluationRow(row as Record<string, unknown>),
    ])
  )

  const contactById = new Map((contactsResult.data ?? []).map((row) => [row.id as string, row]))
  const boothNumberById = new Map(
    (boothsResult.data ?? []).map((row) => [row.id as string, row.number as string])
  )

  const rows = participantAssignments.map((assignment) => {
    const contactId = assignment.contact_id as string
    const contact = contactById.get(contactId)

    return {
      contactId,
      vendorName: resolveParticipantDisplayName({ contact }),
      vendorEmail: (contact?.email as string | null) ?? null,
      boothNumber: assignment.booth_id
        ? boothNumberById.get(assignment.booth_id as string) ?? null
        : null,
      boothAssignmentId: assignment.id as string,
      assignmentStatus: (assignment.status as string | null) ?? null,
      evaluation: evaluationByContact.get(contactId) ?? null,
    }
  })

  const evaluatedCount = rows.filter((row) => row.evaluation).length

  return {
    participantsTotal: rows.length,
    evaluatedCount,
    pendingCount: rows.length - evaluatedCount,
    rows,
  }
}

export async function countPendingEventEvaluations(
  eventId: string,
  organizationId: string
): Promise<number> {
  try {
    const summary = await getEventVendorEvaluations(eventId, organizationId)
    return summary.pendingCount
  } catch {
    return 0
  }
}

export async function getVendorEvaluationsForContact(
  contactId: string
): Promise<VendorContactEvaluationRow[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return []
  }

  const supabase = await createClient()

  const { data: evaluations, error } = await supabase
    .from("vendor_hub_participation_evaluations")
    .select(
      "id, vendor_hub_event_id, rating, would_invite_again, notes, reviewed_at, booth_assignment_id"
    )
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .order("reviewed_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("getVendorEvaluationsForContact:", error)
    return []
  }

  if (!evaluations?.length) {
    return []
  }

  const eventIds = [...new Set(evaluations.map((row) => row.vendor_hub_event_id as string))]
  const assignmentIds = [
    ...new Set(
      evaluations.map((row) => row.booth_assignment_id).filter(Boolean) as string[]
    ),
  ]

  const [eventsResult, assignmentsResult] = await Promise.all([
    supabase
      .from("vendor_hub_events")
      .select("id, name, event_date")
      .in("id", eventIds),
    assignmentIds.length > 0
      ? supabase
          .from("vendor_hub_booth_assignments")
          .select("id, booth_id")
          .in("id", assignmentIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const eventById = new Map((eventsResult.data ?? []).map((row) => [row.id as string, row]))
  const boothIds = [
    ...new Set(
      (assignmentsResult.data ?? []).map((row) => row.booth_id).filter(Boolean) as string[]
    ),
  ]

  const { data: booths } =
    boothIds.length > 0
      ? await supabase.from("vendor_hub_booths").select("id, number").in("id", boothIds)
      : { data: [] }

  const boothNumberById = new Map((booths ?? []).map((row) => [row.id as string, row.number as string]))
  const assignmentBoothId = new Map(
    (assignmentsResult.data ?? []).map((row) => [row.id as string, row.booth_id as string | null])
  )

  return evaluations.map((row) => {
    const event = eventById.get(row.vendor_hub_event_id as string)
    const boothId = row.booth_assignment_id
      ? assignmentBoothId.get(row.booth_assignment_id as string)
      : null

    return {
      id: row.id as string,
      eventId: row.vendor_hub_event_id as string,
      eventName: (event?.name as string) ?? "Bazaar event",
      eventDate: (event?.event_date as string | null) ?? null,
      boothNumber: boothId ? boothNumberById.get(boothId) ?? null : null,
      rating: row.rating as VendorParticipationRating,
      wouldInviteAgain:
        row.would_invite_again === null || row.would_invite_again === undefined
          ? null
          : Boolean(row.would_invite_again),
      notes: (row.notes as string | null) ?? null,
      reviewedAt: (row.reviewed_at as string | null) ?? null,
    }
  })
}

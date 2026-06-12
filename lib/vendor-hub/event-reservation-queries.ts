import { createClient } from "@/lib/supabase/server"
import type { BazaarEventReservationRow } from "@/lib/vendor-hub/vendor-hub-types"

export async function getBazaarEventReservations(
  eventId: string,
  organizationId: string
): Promise<BazaarEventReservationRow[]> {
  const supabase = await createClient()

  const [participantsResult, assignmentsResult] = await Promise.all([
    supabase
      .from("vendor_hub_participant_status")
      .select(
        "id, contact_id, lifecycle_status, created_at, updated_at, application_id"
      )
      .eq("vendor_hub_event_id", eventId)
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("vendor_hub_booth_assignments")
      .select("id, contact_id, booth_id, fee_amount, status, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
  ])

  const contactIds = new Set<string>()
  for (const row of participantsResult.data ?? []) {
    if (row.contact_id) contactIds.add(row.contact_id as string)
  }
  for (const row of assignmentsResult.data ?? []) {
    if (row.contact_id) contactIds.add(row.contact_id as string)
  }

  const boothIds = [
    ...new Set(
      (assignmentsResult.data ?? [])
        .map((row) => row.booth_id as string | null)
        .filter(Boolean) as string[]
    ),
  ]

  const [contactsResult, boothsResult] = await Promise.all([
    contactIds.size > 0
      ? supabase
          .from("contacts")
          .select("id, full_name, email, company_name")
          .in("id", [...contactIds])
      : Promise.resolve({ data: [], error: null }),
    boothIds.length > 0
      ? supabase.from("vendor_hub_booths").select("id, number").in("id", boothIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const contactById = new Map(
    (contactsResult.data ?? []).map((row) => [row.id as string, row])
  )
  const boothNumberById = new Map(
    (boothsResult.data ?? []).map((row) => [row.id as string, row.number as string])
  )

  const assignmentByContact = new Map<
    string,
    NonNullable<typeof assignmentsResult.data>[number][]
  >()
  for (const assignment of assignmentsResult.data ?? []) {
    const contactId = assignment.contact_id as string
    const list = assignmentByContact.get(contactId) ?? []
    list.push(assignment)
    assignmentByContact.set(contactId, list)
  }

  const rows: BazaarEventReservationRow[] = []
  const seenContacts = new Set<string>()

  for (const participant of participantsResult.data ?? []) {
    const contactId = participant.contact_id as string
    seenContacts.add(contactId)
    const contact = contactById.get(contactId)
    const assignments = assignmentByContact.get(contactId) ?? []
    const primary = assignments[0]

    rows.push({
      id: participant.id as string,
      contactId,
      vendorName:
        (contact?.company_name as string | null) ||
        (contact?.full_name as string | null) ||
        "Vendor",
      vendorEmail: (contact?.email as string | null) ?? null,
      lifecycleStatus: participant.lifecycle_status as string,
      boothNumber: primary?.booth_id
        ? boothNumberById.get(primary.booth_id as string) ?? null
        : null,
      feeAmount: primary?.fee_amount ? Number(primary.fee_amount) : null,
      assignmentStatus: (primary?.status as string | null) ?? null,
      reservedAt:
        (primary?.created_at as string | null) ??
        (participant.updated_at as string | null) ??
        (participant.created_at as string),
    })
  }

  for (const assignment of assignmentsResult.data ?? []) {
    const contactId = assignment.contact_id as string
    if (seenContacts.has(contactId)) continue

    const contact = contactById.get(contactId)
    rows.push({
      id: `assign-${assignment.id}`,
      contactId,
      vendorName:
        (contact?.company_name as string | null) ||
        (contact?.full_name as string | null) ||
        "Vendor",
      vendorEmail: (contact?.email as string | null) ?? null,
      lifecycleStatus: (assignment.status as string) ?? "reserved",
      boothNumber: assignment.booth_id
        ? boothNumberById.get(assignment.booth_id as string) ?? null
        : null,
      feeAmount: assignment.fee_amount ? Number(assignment.fee_amount) : null,
      assignmentStatus: (assignment.status as string | null) ?? null,
      reservedAt: assignment.created_at as string,
    })
  }

  rows.sort((a, b) => {
    const aTime = a.reservedAt ? new Date(a.reservedAt).getTime() : 0
    const bTime = b.reservedAt ? new Date(b.reservedAt).getTime() : 0
    return bTime - aTime
  })

  return rows
}

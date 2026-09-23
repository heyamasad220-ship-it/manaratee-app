import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { formatContactDisplayName } from "@/lib/vendor-hub/contact-centric-model"
import { getVendorHubEvents } from "@/lib/vendor-hub/vendor-hub-event-queries"
import {
  formatBoothOrderLabel,
  pickRecentOrders,
  type OverviewRecentOrder,
} from "@/lib/vendor-hub/vendor-hub-overview"

function parseCategoryFromNotes(notes: string | null | undefined) {
  if (!notes) return null
  const match = String(notes).match(/(?:^|\n)category=([^\n]*)/i)
  const value = match?.[1]?.trim()
  return value || null
}

function paymentTime(payment: {
  payment_date: string | null
  created_at: string | null
}) {
  return payment.payment_date || payment.created_at || ""
}

export async function getRecentVendorHubOrders(
  eventId?: string | null,
  limit = 8
): Promise<OverviewRecentOrder[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const events = await getVendorHubEvents()
  const eventIds =
    eventId && eventId !== "all"
      ? events.filter((event) => event.id === eventId).map((event) => event.id)
      : events.map((event) => event.id)

  if (eventIds.length === 0) return []

  const supabase = await createClient()
  const { data: payments, error } = await supabase
    .from("vendor_hub_payments")
    .select(
      "id, event_id, contact_id, booth_assignment_id, amount, payment_type, payment_date, created_at, notes"
    )
    .in("event_id", eventIds)
    .order("created_at", { ascending: false })
    .limit(80)

  if (error) {
    console.error("getRecentVendorHubOrders payments:", error.message)
    return []
  }

  const paidRows = (payments || []).filter(
    (row) => ((row.payment_type as string | null) || "").toLowerCase() !== "refund"
  )

  const assignmentIds = [
    ...new Set(
      paidRows
        .map((row) => row.booth_assignment_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const assignmentsById = new Map<
    string,
    { booth_id: string | null; contact_id: string | null }
  >()
  if (assignmentIds.length > 0) {
    const { data: assignments } = await supabase
      .from("vendor_hub_booth_assignments")
      .select("id, booth_id, contact_id")
      .in("id", assignmentIds)
    for (const row of assignments || []) {
      assignmentsById.set(row.id as string, {
        booth_id: (row.booth_id as string | null) ?? null,
        contact_id: (row.contact_id as string | null) ?? null,
      })
    }
  }

  const boothIds = [
    ...new Set(
      [...assignmentsById.values()]
        .map((row) => row.booth_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const boothById = new Map<
    string,
    { number: string | null; booth_type_id: string | null }
  >()
  const typeIds = new Set<string>()
  if (boothIds.length > 0) {
    const { data: booths } = await supabase
      .from("vendor_hub_booths")
      .select("id, number, booth_type_id")
      .in("id", boothIds)
    for (const booth of booths || []) {
      const typeId = (booth.booth_type_id as string | null) ?? null
      boothById.set(booth.id as string, {
        number: (booth.number as string | null) ?? null,
        booth_type_id: typeId,
      })
      if (typeId) typeIds.add(typeId)
    }
  }

  const typeNameById = new Map<string, string>()
  if (typeIds.size > 0) {
    const { data: types } = await supabase
      .from("vendor_hub_booth_types")
      .select("id, name")
      .in("id", [...typeIds])
    for (const type of types || []) {
      typeNameById.set(type.id as string, (type.name as string) || "Booth")
    }
  }

  const contactIds = [
    ...new Set(
      paidRows
        .map((row) => row.contact_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const contactsById = new Map<
    string,
    {
      id: string
      full_name: string | null
      first_name: string | null
      last_name: string | null
      organization_name: string | null
      company_name: string | null
      email: string | null
    }
  >()
  if (contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, full_name, email")
      .eq("organization_id", organizationId)
      .in("id", contactIds)
    for (const contact of contacts || []) {
      contactsById.set(contact.id as string, {
        id: contact.id as string,
        full_name: (contact.full_name as string | null) ?? null,
        first_name: null,
        last_name: null,
        organization_name: null,
        company_name: null,
        email: (contact.email as string | null) ?? null,
      })
    }
  }

  const orders: OverviewRecentOrder[] = paidRows.map((row) => {
    const assignmentId = row.booth_assignment_id as string | null
    const assignment = assignmentId ? assignmentsById.get(assignmentId) : null
    const booth = assignment?.booth_id ? boothById.get(assignment.booth_id) : null
    const typeName = booth?.booth_type_id
      ? typeNameById.get(booth.booth_type_id) ?? null
      : parseCategoryFromNotes(row.notes as string | null)
    const contactId = (row.contact_id as string | null) ?? assignment?.contact_id ?? null
    const contact = contactId ? contactsById.get(contactId) : null

    return {
      id: row.id as string,
      contactId,
      vendorName: formatContactDisplayName(contact),
      boothLabel: formatBoothOrderLabel(typeName, booth?.number ?? null),
      amountPaid: Number(row.amount ?? 0) || 0,
      paidAt: paymentTime(row) || null,
    }
  })

  return pickRecentOrders(orders, limit)
}

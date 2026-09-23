import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  resolveBoothOrderStatus,
  resolveVendorTypeName,
  type BoothOrderRow,
} from "@/lib/vendor-hub/booth-orders"
import { canonicalBoothTypeName } from "@/lib/vendor-hub/booth-type-names"
import { formatContactDisplayName } from "@/lib/vendor-hub/contact-centric-model"
import {
  parseCategoryFromNotes,
  stripCategoryFromNotes,
} from "@/lib/vendor-hub/event-participating-vendors-queries"
import { getVendorHubEvents } from "@/lib/vendor-hub/vendor-hub-event-queries"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import {
  VENDOR_ORG_APPLICATION_MODULE,
  VENDOR_ORG_APPLICATION_TYPE,
} from "@/lib/vendor-hub/vendor-participation-model"

function money(value: number) {
  return Number.isFinite(value) ? value : 0
}

function businessNameFromFormData(formData: unknown) {
  if (!formData || typeof formData !== "object") return null
  const value = (formData as Record<string, unknown>).business_name
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function vendorTypeIdFromFormData(formData: unknown) {
  if (!formData || typeof formData !== "object") return null
  const value = (formData as Record<string, unknown>).vendor_type_id
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function parseBoothFromNotes(notes: string | null | undefined) {
  if (!notes) return null
  const match = String(notes).match(/(?:^|\n)booth=([^\n]*)/i)
  const value = match?.[1]?.trim()
  return value || null
}

function paymentTimestamp(row: {
  payment_date?: string | null
  created_at?: string | null
}) {
  return (row.payment_date as string | null) || (row.created_at as string | null) || null
}

/**
 * Purchased booths / orders for Vendor Hub Reports and the bazaar Vendors tab.
 * One row per booth assignment, plus payment-only contacts with no assignment.
 */
export async function getBoothOrders(
  eventId?: string | null
): Promise<BoothOrderRow[]> {
  const events = await getVendorHubEvents()
  const scopedEvents =
    eventId && eventId !== "all" ? events.filter((event) => event.id === eventId) : events

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId || scopedEvents.length === 0) return []

  const eventIds = scopedEvents.map((event) => event.id)
  const eventById = new Map(scopedEvents.map((event) => [event.id, event]))
  const supabase = await createClient()

  const [
    { data: assignments },
    { data: payments },
    { data: booths },
    { data: boothTypes },
    { data: defaultBoothTypes },
    { data: participants },
    { data: vendorTypes },
  ] = await Promise.all([
    supabase
      .from("vendor_hub_booth_assignments")
      .select("id, event_id, booth_id, contact_id, fee_amount, status")
      .in("event_id", eventIds),
    supabase
      .from("vendor_hub_payments")
      .select(
        "id, event_id, contact_id, booth_assignment_id, amount, payment_type, payment_date, notes, created_at"
      )
      .in("event_id", eventIds),
    supabase
      .from("vendor_hub_booths")
      .select("id, event_id, booth_type_id, status, number")
      .in("event_id", eventIds),
    supabase
      .from("vendor_hub_booth_types")
      .select("id, name, price, event_id")
      .eq("organization_id", organizationId),
    supabase
      .from("vendor_hub_booth_types")
      .select("id, name")
      .eq("organization_id", organizationId)
      .is("event_id", null)
      .eq("is_active", true),
    supabase
      .from("vendor_hub_participant_status")
      .select("id, contact_id, vendor_hub_event_id, lifecycle_status, notes")
      .eq("organization_id", organizationId)
      .in("vendor_hub_event_id", eventIds),
    supabase
      .from("vendor_hub_vendor_types")
      .select("id, name, slug")
      .eq("organization_id", organizationId),
  ])

  const assignmentRows = (assignments || []).filter(
    (row) => ((row.status as string | null) || "") !== "cancelled"
  )
  const paymentRows = payments || []
  const boothRows = booths || []
  const boothTypeRows = boothTypes || []
  const participantRows = participants || []
  const catalog = (vendorTypes || []).map((row) => ({
    id: row.id as string,
    name: String(row.name || "").trim(),
    slug: (row.slug as string | null) || null,
  }))
  const catalogNameById = new Map(catalog.map((row) => [row.id, row.name]))

  const cancelledContactKeys = new Set<string>()
  const participantByKey = new Map<string, (typeof participantRows)[number]>()
  for (const row of participantRows) {
    const contactId = row.contact_id as string | null
    const vendorEventId = row.vendor_hub_event_id as string | null
    if (!contactId || !vendorEventId) continue
    const key = `${vendorEventId}:${contactId}`
    if ((row.lifecycle_status as string | null) === "cancelled") {
      cancelledContactKeys.add(key)
      continue
    }
    if (!participantByKey.has(key)) participantByKey.set(key, row)
  }

  const activeAssignments = assignmentRows.filter((row) => {
    const contactId = row.contact_id as string | null
    const assignmentEventId = row.event_id as string | null
    if (!contactId || !assignmentEventId) return false
    return !cancelledContactKeys.has(`${assignmentEventId}:${contactId}`)
  })

  const assignmentIdsByContactEvent = new Map<string, string[]>()
  for (const row of activeAssignments) {
    const contactId = row.contact_id as string
    const assignmentEventId = row.event_id as string
    const key = `${assignmentEventId}:${contactId}`
    const list = assignmentIdsByContactEvent.get(key) || []
    list.push(row.id as string)
    assignmentIdsByContactEvent.set(key, list)
  }

  const paidByAssignment = new Map<string, number>()
  const paidAtByAssignment = new Map<string, string>()
  const paymentCountByAssignment = new Map<string, number>()
  const unassignedPaidByContactEvent = new Map<string, number>()
  const unassignedCountByContactEvent = new Map<string, number>()
  const unassignedPaidAtByContactEvent = new Map<string, string>()
  const notesCategoryByContactEvent = new Map<string, string>()
  const notesBoothByContactEvent = new Map<string, string>()

  function rememberTimestamp(map: Map<string, string>, key: string, value: string | null) {
    if (!value) return
    const current = map.get(key)
    if (!current || value > current) map.set(key, value)
  }

  for (const payment of paymentRows) {
    const contactId = payment.contact_id as string | null
    const paymentEventId = payment.event_id as string | null
    if (!contactId || !paymentEventId) continue
    const key = `${paymentEventId}:${contactId}`
    if (cancelledContactKeys.has(key)) continue

    const amount = Number(payment.amount ?? 0)
    const isRefund = (payment.payment_type as string | null) === "refund"
    const signed = Number.isFinite(amount) ? (isRefund ? -Math.abs(amount) : amount) : 0
    const assignmentId = payment.booth_assignment_id as string | null
    const stamp = paymentTimestamp(payment)

    if (!isRefund) {
      const category = parseCategoryFromNotes(payment.notes as string | null)
      if (category && !notesCategoryByContactEvent.has(key)) {
        notesCategoryByContactEvent.set(key, category)
      }
      const boothFromNotes = parseBoothFromNotes(payment.notes as string | null)
      if (boothFromNotes && !notesBoothByContactEvent.has(key)) {
        notesBoothByContactEvent.set(key, boothFromNotes)
      }
    }

    if (assignmentId) {
      paidByAssignment.set(assignmentId, (paidByAssignment.get(assignmentId) || 0) + signed)
      paymentCountByAssignment.set(
        assignmentId,
        (paymentCountByAssignment.get(assignmentId) || 0) + 1
      )
      rememberTimestamp(paidAtByAssignment, assignmentId, stamp)
      continue
    }

    unassignedPaidByContactEvent.set(
      key,
      (unassignedPaidByContactEvent.get(key) || 0) + signed
    )
    unassignedCountByContactEvent.set(
      key,
      (unassignedCountByContactEvent.get(key) || 0) + 1
    )
    rememberTimestamp(unassignedPaidAtByContactEvent, key, stamp)
  }

  const contactIds = [
    ...new Set(
      [
        ...activeAssignments.map((row) => row.contact_id as string | null),
        ...paymentRows.map((row) => row.contact_id as string | null),
        ...[...participantByKey.values()].map((row) => row.contact_id as string | null),
      ].filter((id): id is string => Boolean(id))
    ),
  ]

  const contactsById = new Map<
    string,
    {
      id: string
      full_name: string | null
      email: string | null
      phone: string | null
      organization_name: string | null
      company_name: string | null
      primary_contact_name: string | null
    }
  >()
  const businessByContact = new Map<string, string>()
  const vendorTypeIdByContact = new Map<string, string>()

  if (contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, full_name, email, phone, primary_contact_name")
      .eq("organization_id", organizationId)
      .in("id", contactIds)

    for (const contact of contacts || []) {
      contactsById.set(contact.id as string, {
        id: contact.id as string,
        full_name: (contact.full_name as string | null) ?? null,
        email: (contact.email as string | null) ?? null,
        phone: (contact.phone as string | null) ?? null,
        organization_name: null,
        company_name: null,
        primary_contact_name: (contact.primary_contact_name as string | null) ?? null,
      })
    }

    const { data: applications } = await supabase
      .from("applications")
      .select("contact_id, form_data, created_at, module_owner")
      .eq("organization_id", organizationId)
      .eq("application_type", VENDOR_ORG_APPLICATION_TYPE)
      .in("contact_id", contactIds)
      .order("created_at", { ascending: false })

    for (const app of applications || []) {
      const contactId = app.contact_id as string | null
      if (!contactId) continue
      const moduleOwner = (app.module_owner as string | null) || null
      if (
        moduleOwner &&
        moduleOwner !== VENDOR_ORG_APPLICATION_MODULE &&
        moduleOwner !== "bazaar"
      ) {
        continue
      }
      if (!businessByContact.has(contactId)) {
        const businessName = businessNameFromFormData(app.form_data)
        if (businessName) businessByContact.set(contactId, businessName)
      }
      if (!vendorTypeIdByContact.has(contactId)) {
        const typeId = vendorTypeIdFromFormData(app.form_data)
        if (typeId) vendorTypeIdByContact.set(contactId, typeId)
      }
    }
  }

  const defaultNames = new Set(
    (defaultBoothTypes || []).map((row) => String(row.name || "")).filter(Boolean)
  )
  const boothTypeById = new Map(
    boothTypeRows.map((row) => [
      row.id as string,
      {
        name: (row.name as string) || "Booth",
        price: Number(row.price ?? 0),
      },
    ])
  )
  const boothById = new Map(
    boothRows.map((row) => [
      row.id as string,
      {
        boothTypeId: (row.booth_type_id as string | null) ?? null,
        number: (row.number as string | null) ?? null,
      },
    ])
  )

  const rows: BoothOrderRow[] = []
  const contactsWithAssignment = new Set<string>()

  for (const assignment of activeAssignments) {
    const contactId = assignment.contact_id as string
    const assignmentEventId = assignment.event_id as string
    const key = `${assignmentEventId}:${contactId}`
    contactsWithAssignment.add(key)

    const event = eventById.get(assignmentEventId)
    const contact = contactsById.get(contactId)
    const boothId = (assignment.booth_id as string | null) ?? null
    const booth = boothId ? boothById.get(boothId) : null
    const boothTypeRecord = booth?.boothTypeId ? boothTypeById.get(booth.boothTypeId) : null
    const notesCategory =
      parseCategoryFromNotes(participantByKey.get(key)?.notes as string | null) ||
      notesCategoryByContactEvent.get(key) ||
      null
    const rawBoothType = boothTypeRecord?.name || notesCategory || ""
    const boothType = rawBoothType
      ? canonicalBoothTypeName(rawBoothType, defaultNames)
      : null
    const vendorTypeId = vendorTypeIdByContact.get(contactId) ?? null
    const vendorType = resolveVendorTypeName({
      catalogName: vendorTypeId ? catalogNameById.get(vendorTypeId) || null : null,
      notesCategory,
      catalog,
    })
    const assignmentId = assignment.id as string
    const siblingIds = assignmentIdsByContactEvent.get(key) || []
    const assignedPaid = paidByAssignment.get(assignmentId) || 0
    const leftover =
      siblingIds.length === 1 ? unassignedPaidByContactEvent.get(key) || 0 : 0
    const paid = money(assignedPaid + leftover)
    const paymentCount =
      (paymentCountByAssignment.get(assignmentId) || 0) +
      (siblingIds.length === 1 ? unassignedCountByContactEvent.get(key) || 0 : 0)
    const paidAt =
      paidAtByAssignment.get(assignmentId) ||
      (siblingIds.length === 1 ? unassignedPaidAtByContactEvent.get(key) || null : null)
    const boothFee = money(
      Number(assignment.fee_amount ?? boothTypeRecord?.price ?? (paid > 0 ? paid : 0))
    )
    const participant = participantByKey.get(key)
    const vendorName =
      businessByContact.get(contactId) ||
      (contact ? formatContactDisplayName(contact) : null) ||
      "Unknown vendor"
    const contactName =
      (contact?.primary_contact_name || "").trim() ||
      (contact?.full_name || "").trim() ||
      vendorName

    rows.push({
      id: assignmentId,
      eventId: assignmentEventId,
      eventName: event?.name || "Bazaar",
      eventDate: event?.event_date ?? null,
      contactId,
      vendorName,
      contactName,
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
      vendorType,
      vendorTypeId,
      boothType,
      boothNumber: booth?.number || notesBoothByContactEvent.get(key) || null,
      boothId,
      assignmentId,
      participantId: (participant?.id as string | null) ?? null,
      status: resolveBoothOrderStatus({
        paid,
        boothFee,
        assignmentStatus: (assignment.status as string | null) ?? null,
        lifecycleStatus: (participant?.lifecycle_status as string | null) ?? null,
      }),
      boothFee,
      paid,
      paymentCount,
      paidAt,
      notes: stripCategoryFromNotes(participant?.notes as string | null),
      profileHref: VENDOR_HUB_ROUTES.network.vendor(contactId),
    })
  }

  const paymentOnlyKeys = new Set<string>()
  for (const payment of paymentRows) {
    const contactId = payment.contact_id as string | null
    const paymentEventId = payment.event_id as string | null
    if (!contactId || !paymentEventId) continue
    const key = `${paymentEventId}:${contactId}`
    if (cancelledContactKeys.has(key) || contactsWithAssignment.has(key)) continue
    paymentOnlyKeys.add(key)
  }
  for (const key of participantByKey.keys()) {
    if (cancelledContactKeys.has(key) || contactsWithAssignment.has(key)) continue
    paymentOnlyKeys.add(key)
  }

  for (const key of paymentOnlyKeys) {
    const [paymentEventId, contactId] = key.split(":")
    const paid = money(unassignedPaidByContactEvent.get(key) || 0)
    const participant = participantByKey.get(key)
    if (paid <= 0 && !participant) continue

    const event = eventById.get(paymentEventId)
    const contact = contactsById.get(contactId)
    const notesCategory =
      parseCategoryFromNotes(participant?.notes as string | null) ||
      notesCategoryByContactEvent.get(key) ||
      null
    const vendorTypeId = vendorTypeIdByContact.get(contactId) ?? null
    const vendorName =
      businessByContact.get(contactId) ||
      (contact ? formatContactDisplayName(contact) : null) ||
      "Unknown vendor"
    const contactName =
      (contact?.primary_contact_name || "").trim() ||
      (contact?.full_name || "").trim() ||
      vendorName

    rows.push({
      id: `payment:${paymentEventId}:${contactId}`,
      eventId: paymentEventId,
      eventName: event?.name || "Bazaar",
      eventDate: event?.event_date ?? null,
      contactId,
      vendorName,
      contactName,
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
      vendorType: resolveVendorTypeName({
        catalogName: vendorTypeId ? catalogNameById.get(vendorTypeId) || null : null,
        notesCategory,
        catalog,
      }),
      vendorTypeId,
      boothType: notesCategory ? canonicalBoothTypeName(notesCategory, defaultNames) : null,
      boothNumber: notesBoothByContactEvent.get(key) || null,
      boothId: null,
      assignmentId: null,
      participantId: (participant?.id as string | null) ?? null,
      status: resolveBoothOrderStatus({
        paid,
        boothFee: paid,
        lifecycleStatus: (participant?.lifecycle_status as string | null) ?? null,
      }),
      boothFee: paid,
      paid,
      paymentCount: unassignedCountByContactEvent.get(key) || 0,
      paidAt: unassignedPaidAtByContactEvent.get(key) || null,
      notes: stripCategoryFromNotes(participant?.notes as string | null),
      profileHref: VENDOR_HUB_ROUTES.network.vendor(contactId),
    })
  }

  return rows.sort((a, b) => {
    const byVendor = a.vendorName.localeCompare(b.vendorName)
    if (byVendor !== 0) return byVendor
    return (a.boothNumber || "").localeCompare(b.boothNumber || "")
  })
}

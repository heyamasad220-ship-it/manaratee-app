import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

/** One row per vendor for Reports → Participation History. */
export type ParticipationHistoryRow = {
  contactId: string
  businessName: string
  contactName: string | null
  email: string | null
  phone: string | null
  vendorType: string | null
  eventCount: number
  lastEventId: string | null
  lastEventName: string
  lastEventDate: string | null
  lastAmountPaid: number | null
}

/** One row per event for a vendor profile participation table. */
export type ContactParticipationEventRow = {
  id: string
  eventId: string | null
  eventName: string
  eventDate: string | null
  boothType: string | null
  amount: number | null
}

function parseCategoryFromNotes(notes: string | null | undefined) {
  if (!notes) return null
  const match = String(notes).match(/(?:^|\n)category=([^\n]*)/i)
  const value = match?.[1]?.trim()
  return value || null
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

type ContactMeta = {
  fullName: string | null
  email: string | null
  phone: string | null
  contactType: string | null
  primaryContactName: string | null
}

async function loadVendorMetaByContact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  contactIds: string[]
) {
  const nameByContact = new Map<string, string>()
  const typeIdByContact = new Map<string, string>()
  const contactById = new Map<string, ContactMeta>()
  if (contactIds.length === 0) {
    return { nameByContact, typeIdByContact, contactById }
  }

  const chunkSize = 200
  for (let i = 0; i < contactIds.length; i += chunkSize) {
    const chunk = contactIds.slice(i, i + chunkSize)

    const { data: applications } = await supabase
      .from("applications")
      .select("contact_id, form_data, created_at")
      .eq("organization_id", organizationId)
      .eq("application_type", "vendor")
      .in("contact_id", chunk)
      .order("created_at", { ascending: false })

    for (const row of applications || []) {
      const contactId = row.contact_id as string | null
      if (!contactId) continue
      if (!nameByContact.has(contactId)) {
        const businessName = businessNameFromFormData(row.form_data)
        if (businessName) nameByContact.set(contactId, businessName)
      }
      if (!typeIdByContact.has(contactId)) {
        const typeId = vendorTypeIdFromFormData(row.form_data)
        if (typeId) typeIdByContact.set(contactId, typeId)
      }
    }

    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, full_name, email, phone, contact_type, primary_contact_name")
      .in("id", chunk)

    for (const contact of contacts || []) {
      const fullName = ((contact.full_name as string | null) || "").trim() || null
      const email = ((contact.email as string | null) || "").trim() || null
      const phone = ((contact.phone as string | null) || "").trim() || null
      contactById.set(contact.id, {
        fullName,
        email,
        phone,
        contactType: (contact.contact_type as string | null) || null,
        primaryContactName:
          ((contact.primary_contact_name as string | null) || "").trim() || null,
      })
      if (!nameByContact.has(contact.id)) {
        const fallback = fullName || email
        if (fallback) nameByContact.set(contact.id, fallback)
      }
    }
  }

  return { nameByContact, typeIdByContact, contactById }
}

function primaryContactLabel(contact: ContactMeta | undefined) {
  if (!contact) return null
  if (contact.contactType === "organization") {
    return contact.primaryContactName || contact.fullName
  }
  return contact.fullName
}

type PaymentRow = {
  id: string
  event_id: string | null
  contact_id: string | null
  amount: number | null
  notes: string | null
  payment_date: string | null
  created_at: string | null
  payment_type: string | null
}

type ParticipantRow = {
  contact_id: string | null
  vendor_hub_event_id: string | null
}

type EventInfo = {
  id: string
  name: string
  eventDate: string | null
}

function eventSortKey(eventDate: string | null | undefined) {
  if (!eventDate) return 0
  const time = new Date(eventDate).getTime()
  return Number.isNaN(time) ? 0 : time
}

function paymentSortKey(payment: PaymentRow) {
  const date = payment.payment_date || payment.created_at
  if (!date) return 0
  const time = new Date(date).getTime()
  return Number.isNaN(time) ? 0 : time
}

function isRefund(payment: PaymentRow) {
  return (payment.payment_type || "").toLowerCase() === "refund"
}

async function loadOrgEvents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string
) {
  const { data: events } = await supabase
    .from("vendor_hub_events")
    .select("id, name, event_date")
    .eq("organization_id", organizationId)

  return new Map(
    (events || []).map((event) => [
      event.id as string,
      {
        id: event.id as string,
        name: (event.name as string | null) ?? "Bazaar event",
        eventDate: (event.event_date as string | null) ?? null,
      } satisfies EventInfo,
    ])
  )
}

/** Per-event rows for a single vendor profile. */
export async function getContactParticipationEvents(
  contactId: string
): Promise<ContactParticipationEventRow[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId || !contactId) return []

  const supabase = await createClient()
  const eventById = await loadOrgEvents(supabase, organizationId)
  const eventIds = [...eventById.keys()]
  if (eventIds.length === 0) return []

  const [{ data: payments }, { data: participants }] = await Promise.all([
    supabase
      .from("vendor_hub_payments")
      .select("id, event_id, contact_id, amount, notes, payment_date, created_at, payment_type")
      .eq("contact_id", contactId)
      .in("event_id", eventIds)
      .limit(500),
    supabase
      .from("vendor_hub_participant_status")
      .select("contact_id, vendor_hub_event_id")
      .eq("contact_id", contactId)
      .in("vendor_hub_event_id", eventIds)
      .limit(500),
  ])

  const paymentRows = (payments || []) as PaymentRow[]
  const participantRows = (participants || []) as ParticipantRow[]

  const byEvent = new Map<
    string,
    { boothType: string | null; amount: number | null; paymentTime: number }
  >()

  for (const participant of participantRows) {
    const eventId = participant.vendor_hub_event_id
    if (!eventId || !eventById.has(eventId) || byEvent.has(eventId)) continue
    byEvent.set(eventId, { boothType: null, amount: null, paymentTime: 0 })
  }

  for (const payment of paymentRows) {
    const eventId = payment.event_id
    if (!eventId || !eventById.has(eventId)) continue
    const existing = byEvent.get(eventId) || {
      boothType: null as string | null,
      amount: null as number | null,
      paymentTime: 0,
    }
    const category = parseCategoryFromNotes(payment.notes)
    if (category && !existing.boothType) existing.boothType = category
    if (!isRefund(payment)) {
      const time = paymentSortKey(payment)
      if (time >= existing.paymentTime) {
        existing.paymentTime = time
        existing.amount =
          payment.amount != null && Number.isFinite(Number(payment.amount))
            ? Number(payment.amount)
            : existing.amount
      }
    }
    byEvent.set(eventId, existing)
  }

  const rows: ContactParticipationEventRow[] = [...byEvent.entries()].map(
    ([eventId, data]) => {
      const event = eventById.get(eventId)!
      return {
        id: `event-${eventId}`,
        eventId,
        eventName: event.name,
        eventDate: event.eventDate,
        boothType: data.boothType,
        amount: data.amount,
      }
    }
  )

  rows.sort((a, b) => eventSortKey(b.eventDate) - eventSortKey(a.eventDate))
  return rows
}

export async function getParticipationHistory(
  contactIdFilter?: string | null
): Promise<ParticipationHistoryRow[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return []
  }

  const supabase = await createClient()
  const eventById = await loadOrgEvents(supabase, organizationId)
  const eventIds = [...eventById.keys()]
  if (eventIds.length === 0) {
    return []
  }

  let paymentsQuery = supabase
    .from("vendor_hub_payments")
    .select("id, event_id, contact_id, amount, notes, payment_date, created_at, payment_type")
    .in("event_id", eventIds)
    .limit(2000)

  if (contactIdFilter) {
    paymentsQuery = paymentsQuery.eq("contact_id", contactIdFilter)
  }

  let participantsQuery = supabase
    .from("vendor_hub_participant_status")
    .select("contact_id, vendor_hub_event_id")
    .in("vendor_hub_event_id", eventIds)
    .limit(2000)

  if (contactIdFilter) {
    participantsQuery = participantsQuery.eq("contact_id", contactIdFilter)
  }

  const [{ data: payments, error: paymentsError }, { data: participants, error: participantsError }] =
    await Promise.all([paymentsQuery, participantsQuery])

  if (paymentsError) {
    console.error("getParticipationHistory payments:", paymentsError.message)
  }
  if (participantsError) {
    console.error("getParticipationHistory participants:", participantsError.message)
  }

  const paymentRows = (payments || []) as PaymentRow[]
  const participantRows = (participants || []) as ParticipantRow[]

  const contactIds = Array.from(
    new Set(
      [
        ...paymentRows.map((row) => row.contact_id),
        ...participantRows.map((row) => row.contact_id),
      ].filter((id): id is string => Boolean(id))
    )
  )

  if (contactIds.length === 0) {
    return []
  }

  const { nameByContact, typeIdByContact, contactById } = await loadVendorMetaByContact(
    supabase,
    organizationId,
    contactIds
  )

  const catalogTypeIds = [...new Set(typeIdByContact.values())]
  const catalogNameById = new Map<string, string>()
  if (catalogTypeIds.length > 0) {
    const { data: catalogTypes } = await supabase
      .from("vendor_hub_vendor_types")
      .select("id, name")
      .in("id", catalogTypeIds)
    for (const type of catalogTypes || []) {
      catalogNameById.set(type.id as string, type.name as string)
    }
  }

  const boothTypeByContact = new Map<string, string>()
  for (const payment of paymentRows) {
    const contactId = payment.contact_id
    if (!contactId || boothTypeByContact.has(contactId)) continue
    const category = parseCategoryFromNotes(payment.notes)
    if (category) boothTypeByContact.set(contactId, category)
  }

  type VendorAgg = {
    contactId: string
    eventIds: Set<string>
    payments: PaymentRow[]
  }

  const byContact = new Map<string, VendorAgg>()

  function ensureAgg(id: string) {
    let agg = byContact.get(id)
    if (!agg) {
      agg = { contactId: id, eventIds: new Set(), payments: [] }
      byContact.set(id, agg)
    }
    return agg
  }

  for (const payment of paymentRows) {
    const contactId = payment.contact_id
    if (!contactId) continue
    const agg = ensureAgg(contactId)
    if (payment.event_id && eventById.has(payment.event_id)) {
      agg.eventIds.add(payment.event_id)
    }
    agg.payments.push(payment)
  }

  for (const participant of participantRows) {
    const contactId = participant.contact_id
    const eventId = participant.vendor_hub_event_id
    if (!contactId || !eventId || !eventById.has(eventId)) continue
    ensureAgg(contactId).eventIds.add(eventId)
  }

  const rows: ParticipationHistoryRow[] = [...byContact.values()].map((agg) => {
    const eventsForVendor = [...agg.eventIds]
      .map((eventId) => eventById.get(eventId))
      .filter((event): event is EventInfo => Boolean(event))
      .sort((a, b) => eventSortKey(b.eventDate) - eventSortKey(a.eventDate))

    const lastEvent = eventsForVendor[0] ?? null

    const paidPayments = agg.payments
      .filter((payment) => !isRefund(payment))
      .sort((a, b) => paymentSortKey(b) - paymentSortKey(a))

    const lastPayment = paidPayments[0] ?? null
    const catalogTypeId = typeIdByContact.get(agg.contactId)
    const vendorType =
      (catalogTypeId ? catalogNameById.get(catalogTypeId) : null) ||
      boothTypeByContact.get(agg.contactId) ||
      null

    const contact = contactById.get(agg.contactId)

    return {
      contactId: agg.contactId,
      businessName: nameByContact.get(agg.contactId) || "Unknown vendor",
      contactName: primaryContactLabel(contact),
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
      vendorType,
      eventCount: agg.eventIds.size,
      lastEventId: lastEvent?.id ?? null,
      lastEventName: lastEvent?.name ?? "—",
      lastEventDate: lastEvent?.eventDate ?? null,
      lastAmountPaid:
        lastPayment?.amount != null && Number.isFinite(Number(lastPayment.amount))
          ? Number(lastPayment.amount)
          : null,
    }
  })

  rows.sort((a, b) => {
    const dateDiff = eventSortKey(b.lastEventDate) - eventSortKey(a.lastEventDate)
    if (dateDiff !== 0) return dateDiff
    return a.businessName.localeCompare(b.businessName)
  })

  return rows
}

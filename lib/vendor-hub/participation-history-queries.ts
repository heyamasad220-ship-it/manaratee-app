import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

export type ParticipationHistoryRow = {
  id: string
  contactId: string | null
  businessName: string
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

async function loadBusinessNamesByContact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  contactIds: string[]
) {
  const nameByContact = new Map<string, string>()
  if (contactIds.length === 0) return nameByContact

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
      if (!contactId || nameByContact.has(contactId)) continue
      const businessName = businessNameFromFormData(row.form_data)
      if (businessName) nameByContact.set(contactId, businessName)
    }

    const missing = chunk.filter((id) => !nameByContact.has(id))
    if (missing.length === 0) continue

    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, full_name, email")
      .in("id", missing)

    for (const contact of contacts || []) {
      const fallback = (contact.full_name || contact.email || "").trim()
      if (fallback) nameByContact.set(contact.id, fallback)
    }
  }

  return nameByContact
}

export async function getParticipationHistory(
  contactIdFilter?: string | null
): Promise<ParticipationHistoryRow[]> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return []
  }

  const supabase = await createClient()

  const { data: events } = await supabase
    .from("vendor_hub_events")
    .select("id, name, event_date")
    .eq("organization_id", organizationId)

  const eventById = new Map((events || []).map((event) => [event.id, event]))
  const eventIds = [...eventById.keys()]
  if (eventIds.length === 0) {
    return []
  }

  let paymentsQuery = supabase
    .from("vendor_hub_payments")
    .select("id, event_id, contact_id, amount, notes, payment_date, created_at")
    .in("event_id", eventIds)
    .order("payment_date", { ascending: false })
    .limit(500)

  if (contactIdFilter) {
    paymentsQuery = paymentsQuery.eq("contact_id", contactIdFilter)
  }

  const { data: payments, error: paymentsError } = await paymentsQuery
  if (paymentsError) {
    console.error("getParticipationHistory payments:", paymentsError.message)
    return []
  }

  const contactIds = Array.from(
    new Set(
      (payments || [])
        .map((payment) => payment.contact_id as string | null)
        .filter((id): id is string => Boolean(id))
    )
  )

  const businessByContact = await loadBusinessNamesByContact(
    supabase,
    organizationId,
    contactIds
  )

  const rows: ParticipationHistoryRow[] = (payments || []).map((payment) => {
    const event = payment.event_id ? eventById.get(payment.event_id) : null
    const contactId = (payment.contact_id as string | null) ?? null

    return {
      id: `pay-${payment.id}`,
      contactId,
      businessName: contactId
        ? businessByContact.get(contactId) || "Unknown vendor"
        : "Unknown vendor",
      eventId: payment.event_id,
      eventName: event?.name ?? "Bazaar event",
      eventDate: event?.event_date ?? null,
      boothType: parseCategoryFromNotes(payment.notes as string | null),
      amount: payment.amount != null ? Number(payment.amount) : null,
    }
  })

  rows.sort((a, b) => {
    const aTime = a.eventDate ? new Date(a.eventDate).getTime() : 0
    const bTime = b.eventDate ? new Date(b.eventDate).getTime() : 0
    if (bTime !== aTime) return bTime - aTime
    return (b.amount ?? 0) - (a.amount ?? 0)
  })

  return rows
}

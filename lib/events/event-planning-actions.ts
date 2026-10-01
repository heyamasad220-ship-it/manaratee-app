"use server"

import { revalidatePath } from "next/cache"

import { canManageInternalEvent } from "@/lib/events/event-access"
import {
  dollarsToCents,
  type EventPlanningKind,
  type EventPlanningPastEvent,
  type EventPlanningPlace,
  type EventPlanningQuote,
  type EventPlanningQuoteStatus,
  type EventPlanningSheet,
} from "@/lib/events/event-planning"
import { resolveEventWorkspaceFeatures } from "@/lib/events/event-workspace-features"
import { sendTransactionalEmail } from "@/lib/email/transactional-email"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { createClient } from "@/lib/supabase/server"
import { getEventAttendees } from "@/lib/tickets/ticket-order-queries"
import { getEventTicketTypes } from "@/lib/tickets/ticket-type-actions"

type ActionResult = { success: true } | { success: false; error: string }

async function requirePlanningAccess(eventId: string) {
  const canManage = await canManageInternalEvent(eventId)
  if (!canManage) return { ok: false as const, error: "You do not have permission to plan this event." }
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return { ok: false as const, error: "No organization selected" }
  return { ok: true as const, organizationId }
}

function mapPlace(row: Record<string, unknown>): EventPlanningPlace {
  return {
    id: row.id as string,
    kind: row.kind as EventPlanningKind,
    name: row.name as string,
    contactName: (row.contact_name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    waiverUrl: (row.waiver_url as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  }
}

function mapQuote(row: Record<string, unknown>): EventPlanningQuote {
  const rawPlace = row.event_planning_places as Record<string, unknown> | Record<string, unknown>[]
  const place = Array.isArray(rawPlace) ? rawPlace[0] : rawPlace
  return {
    id: row.id as string,
    placeId: row.place_id as string,
    status: row.status as EventPlanningQuoteStatus,
    priceCents: (row.price_cents as number | null) ?? null,
    includedNotes: (row.included_notes as string | null) ?? null,
    referencePriceCents: (row.reference_price_cents as number | null) ?? null,
    sourceEventId: (row.source_event_id as string | null) ?? null,
    place: mapPlace(place),
  }
}

const emptySheet = (): EventPlanningSheet => ({
  expectedHeadcount: null,
  otherCostCents: null,
  worksheetNotes: null,
  whatsappGroupUrl: null,
  kidsMessage: null,
  kidsTicketTypeIds: [],
})

export async function getEventPlanningAction(eventId: string) {
  const access = await requirePlanningAccess(eventId)
  if (!access.ok) return { success: false as const, error: access.error }

  const supabase = await createClient()
  const [quotesResult, placesResult, sheetResult, pastResult, ticketTypes] = await Promise.all([
    supabase
      .from("event_planning_quotes")
      .select(
        "id, place_id, status, price_cents, included_notes, reference_price_cents, source_event_id, event_planning_places(*)"
      )
      .eq("organization_id", access.organizationId)
      .eq("internal_event_id", eventId),
    supabase
      .from("event_planning_places")
      .select(
        "id, kind, name, contact_name, phone, email, address, website, waiver_url, notes"
      )
      .eq("organization_id", access.organizationId)
      .order("name"),
    supabase
      .from("event_planning_sheets")
      .select(
        "expected_headcount, other_cost_cents, worksheet_notes, whatsapp_group_url, kids_message, kids_ticket_type_ids"
      )
      .eq("internal_event_id", eventId)
      .maybeSingle(),
    supabase
      .from("event_planning_quotes")
      .select("internal_event_id, internal_events(id, name, start_at)")
      .eq("organization_id", access.organizationId)
      .neq("internal_event_id", eventId),
    getEventTicketTypes(eventId),
  ])

  if (quotesResult.error) return { success: false as const, error: quotesResult.error.message }
  if (placesResult.error) return { success: false as const, error: placesResult.error.message }

  const pastById = new Map<string, EventPlanningPastEvent>()
  for (const row of pastResult.data || []) {
    const event = row.internal_events as
      | { id: string; name: string; start_at: string | null }
      | { id: string; name: string; start_at: string | null }[]
      | null
    const record = Array.isArray(event) ? event[0] : event
    if (!record) continue
    pastById.set(record.id, {
      id: record.id,
      name: record.name,
      startAt: record.start_at,
    })
  }

  const sheetRow = sheetResult.data
  const sheet: EventPlanningSheet = sheetRow
    ? {
        expectedHeadcount: sheetRow.expected_headcount,
        otherCostCents: sheetRow.other_cost_cents,
        worksheetNotes: sheetRow.worksheet_notes,
        whatsappGroupUrl: sheetRow.whatsapp_group_url,
        kidsMessage: sheetRow.kids_message,
        kidsTicketTypeIds: sheetRow.kids_ticket_type_ids || [],
      }
    : emptySheet()

  return {
    success: true as const,
    places: (placesResult.data || []).map((row) => mapPlace(row)),
    quotes: (quotesResult.data || []).map((row) => mapQuote(row as Record<string, unknown>)),
    sheet,
    pastEvents: [...pastById.values()].sort((a, b) =>
      (b.startAt || "").localeCompare(a.startAt || "")
    ),
    ticketTypes: ticketTypes.map((type) => ({ id: type.id, name: type.name })),
  }
}

export async function addEventPlanningQuoteAction(input: {
  eventId: string
  kind: EventPlanningKind
  placeId?: string | null
  name?: string | null
  contactName?: string | null
  phone?: string | null
  address?: string | null
  waiverUrl?: string | null
  priceDollars?: string | null
  includedNotes?: string | null
}): Promise<ActionResult> {
  const access = await requirePlanningAccess(input.eventId)
  if (!access.ok) return { success: false, error: access.error }

  const supabase = await createClient()
  let placeId = input.placeId?.trim() || ""
  if (!placeId) {
    const name = input.name?.trim() || ""
    if (!name) return { success: false, error: "Enter a name." }
    const { data: place, error } = await supabase
      .from("event_planning_places")
      .insert({
        organization_id: access.organizationId,
        kind: input.kind,
        name,
        contact_name: input.contactName?.trim() || null,
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        waiver_url: input.kind === "kids_venue" ? input.waiverUrl?.trim() || null : null,
      })
      .select("id")
      .single()
    if (error || !place) return { success: false, error: error?.message || "Could not save the place." }
    placeId = place.id as string
  }

  const priceCents = dollarsToCents(input.priceDollars || "")
  if (input.priceDollars?.trim() && priceCents == null) {
    return { success: false, error: "Enter a valid price." }
  }

  const { error } = await supabase.from("event_planning_quotes").insert({
    organization_id: access.organizationId,
    internal_event_id: input.eventId,
    place_id: placeId,
    status: "considering",
    price_cents: priceCents,
    included_notes: input.includedNotes?.trim() || null,
  })
  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "That place is already on this event." }
    }
    return { success: false, error: error.message }
  }
  revalidatePath(`/event-management/${input.eventId}`)
  return { success: true }
}

export async function updateEventPlanningQuoteAction(input: {
  eventId: string
  quoteId: string
  status: EventPlanningQuoteStatus
  priceDollars: string
  includedNotes: string
}): Promise<ActionResult> {
  const access = await requirePlanningAccess(input.eventId)
  if (!access.ok) return { success: false, error: access.error }
  const priceCents = dollarsToCents(input.priceDollars)
  if (input.priceDollars.trim() && priceCents == null) {
    return { success: false, error: "Enter a valid price." }
  }

  const supabase = await createClient()
  const { data: quote, error: loadError } = await supabase
    .from("event_planning_quotes")
    .select("id, place_id, event_planning_places(kind, name, address)")
    .eq("id", input.quoteId)
    .eq("internal_event_id", input.eventId)
    .eq("organization_id", access.organizationId)
    .maybeSingle()
  if (loadError || !quote) return { success: false, error: "Quote not found." }

  if (input.status === "chosen") {
    const place = quote.event_planning_places as
      | { kind: EventPlanningKind }
      | { kind: EventPlanningKind }[]
      | null
    const kind = Array.isArray(place) ? place[0]?.kind : place?.kind
    if (kind) {
      const { data: siblings } = await supabase
        .from("event_planning_quotes")
        .select("id, event_planning_places!inner(kind)")
        .eq("internal_event_id", input.eventId)
        .eq("organization_id", access.organizationId)
        .eq("status", "chosen")
        .neq("id", input.quoteId)
      const sameKind = (siblings || []).filter((row) => {
        const siblingPlace = row.event_planning_places as { kind: string } | { kind: string }[]
        const siblingKind = Array.isArray(siblingPlace) ? siblingPlace[0]?.kind : siblingPlace?.kind
        return siblingKind === kind
      })
      if (sameKind.length > 0) {
        await supabase
          .from("event_planning_quotes")
          .update({ status: "considering", updated_at: new Date().toISOString() })
          .in(
            "id",
            sameKind.map((row) => row.id as string)
          )
      }
    }
  }

  const { error } = await supabase
    .from("event_planning_quotes")
    .update({
      status: input.status,
      price_cents: priceCents,
      included_notes: input.includedNotes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.quoteId)
    .eq("organization_id", access.organizationId)
  if (error) return { success: false, error: error.message }

  if (input.status === "chosen") {
    const place = quote.event_planning_places as
      | { kind: EventPlanningKind; name: string; address: string | null }
      | { kind: EventPlanningKind; name: string; address: string | null }[]
      | null
    const record = Array.isArray(place) ? place[0] : place
    if (record?.kind === "dinner_venue") {
      await supabase
        .from("internal_events")
        .update({
          location_type: "external",
          location_label: record.name,
          location_address: record.address,
          venue_id: null,
        })
        .eq("id", input.eventId)
        .eq("organization_id", access.organizationId)
    }
  }

  revalidatePath(`/event-management/${input.eventId}`)
  return { success: true }
}

export async function deleteEventPlanningQuoteAction(input: {
  eventId: string
  quoteId: string
}): Promise<ActionResult> {
  const access = await requirePlanningAccess(input.eventId)
  if (!access.ok) return { success: false, error: access.error }
  const supabase = await createClient()
  const { error } = await supabase
    .from("event_planning_quotes")
    .delete()
    .eq("id", input.quoteId)
    .eq("internal_event_id", input.eventId)
    .eq("organization_id", access.organizationId)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/event-management/${input.eventId}`)
  return { success: true }
}

export async function copyEventPlanningQuotesAction(input: {
  eventId: string
  sourceEventId: string
}): Promise<ActionResult & { copied?: number }> {
  const access = await requirePlanningAccess(input.eventId)
  if (!access.ok) return { success: false, error: access.error }
  if (input.sourceEventId === input.eventId) {
    return { success: false, error: "Choose a different event." }
  }
  const supabase = await createClient()
  const { data: sourceQuotes, error } = await supabase
    .from("event_planning_quotes")
    .select("place_id, price_cents")
    .eq("organization_id", access.organizationId)
    .eq("internal_event_id", input.sourceEventId)
  if (error) return { success: false, error: error.message }

  const { data: existing } = await supabase
    .from("event_planning_quotes")
    .select("place_id")
    .eq("internal_event_id", input.eventId)
  const have = new Set((existing || []).map((row) => row.place_id as string))
  const rows = (sourceQuotes || [])
    .filter((row) => !have.has(row.place_id as string))
    .map((row) => ({
      organization_id: access.organizationId,
      internal_event_id: input.eventId,
      place_id: row.place_id,
      status: "considering",
      price_cents: null,
      reference_price_cents: row.price_cents,
      source_event_id: input.sourceEventId,
    }))
  if (rows.length === 0) return { success: true, copied: 0 }
  const { error: insertError } = await supabase.from("event_planning_quotes").insert(rows)
  if (insertError) return { success: false, error: insertError.message }
  revalidatePath(`/event-management/${input.eventId}`)
  return { success: true, copied: rows.length }
}

export async function saveEventPlanningSheetAction(input: {
  eventId: string
  expectedHeadcount: string
  otherCostDollars: string
  worksheetNotes: string
  whatsappGroupUrl: string
  kidsMessage: string
  kidsTicketTypeIds: string[]
}): Promise<ActionResult> {
  const access = await requirePlanningAccess(input.eventId)
  if (!access.ok) return { success: false, error: access.error }
  const headcount = input.expectedHeadcount.trim()
    ? Number.parseInt(input.expectedHeadcount, 10)
    : null
  if (input.expectedHeadcount.trim() && (!Number.isFinite(headcount) || (headcount ?? 0) < 0)) {
    return { success: false, error: "Enter a valid headcount." }
  }
  const otherCostCents = dollarsToCents(input.otherCostDollars)
  if (input.otherCostDollars.trim() && otherCostCents == null) {
    return { success: false, error: "Enter a valid other-cost amount." }
  }
  const supabase = await createClient()
  const { error } = await supabase.from("event_planning_sheets").upsert({
    internal_event_id: input.eventId,
    organization_id: access.organizationId,
    expected_headcount: headcount,
    other_cost_cents: otherCostCents,
    worksheet_notes: input.worksheetNotes.trim() || null,
    whatsapp_group_url: input.whatsappGroupUrl.trim() || null,
    kids_message: input.kidsMessage.trim() || null,
    kids_ticket_type_ids: input.kidsTicketTypeIds,
    updated_at: new Date().toISOString(),
  })
  if (error) return { success: false, error: error.message }
  revalidatePath(`/event-management/${input.eventId}`)
  return { success: true }
}

const DINNER_JOBS = [
  { name: "Registration", openings: 4 },
  { name: "Ushers", openings: 4 },
  { name: "Kids program", openings: 4 },
  { name: "Babysitters", openings: 2 },
]

export async function seedDinnerSignUpJobsAction(eventId: string): Promise<ActionResult> {
  const access = await requirePlanningAccess(eventId)
  if (!access.ok) return { success: false, error: access.error }
  const supabase = await createClient()
  const { data: event, error } = await supabase
    .from("internal_events")
    .select("service_requirements, workspace_features, requires_volunteers, requires_childcare, requires_vendors, requires_ticketing, ticketing_config")
    .eq("id", eventId)
    .eq("organization_id", access.organizationId)
    .maybeSingle()
  if (error || !event) return { success: false, error: "Event not found." }

  const requirements = (event.service_requirements || {}) as Record<string, unknown>
  const volunteers = (requirements.volunteers || {}) as {
    windows?: Array<{ id: string; start: string; end: string; slots: Array<{ id: string; name: string; openings: number }> }>
  }
  const windows = Array.isArray(volunteers.windows) ? [...volunteers.windows] : []
  const first = windows[0] || {
    id: "dinner-jobs",
    start: "18:00",
    end: "22:00",
    slots: [],
  }
  const names = new Set(first.slots.map((slot) => slot.name.trim().toLowerCase()))
  for (const job of DINNER_JOBS) {
    if (names.has(job.name.toLowerCase())) continue
    first.slots.push({
      id: `job-${job.name.toLowerCase().replace(/\s+/g, "-")}`,
      name: job.name,
      openings: job.openings,
    })
  }
  if (!windows[0]) windows.push(first)
  else windows[0] = first

  const features = resolveEventWorkspaceFeatures(event)
  const { error: updateError } = await supabase
    .from("internal_events")
    .update({
      requires_volunteers: true,
      service_requirements: {
        ...requirements,
        volunteers: { ...volunteers, windows },
      },
      workspace_features: { ...features, staff: true },
    })
    .eq("id", eventId)
    .eq("organization_id", access.organizationId)
  if (updateError) return { success: false, error: updateError.message }
  revalidatePath(`/event-management/${eventId}`)
  return { success: true }
}

export async function listKidsProgramFamiliesAction(eventId: string) {
  const access = await requirePlanningAccess(eventId)
  if (!access.ok) return { success: false as const, error: access.error }
  const supabase = await createClient()
  const { data: sheet } = await supabase
    .from("event_planning_sheets")
    .select("kids_ticket_type_ids")
    .eq("internal_event_id", eventId)
    .maybeSingle()
  const selected = new Set((sheet?.kids_ticket_type_ids || []) as string[])
  const [attendees, ticketTypes] = await Promise.all([
    getEventAttendees(eventId),
    getEventTicketTypes(eventId),
  ])
  const kidsTypeIds =
    selected.size > 0
      ? selected
      : new Set(
          ticketTypes
            .filter((type) => /kid/i.test(type.name) && !/babysit/i.test(type.name))
            .map((type) => type.id)
        )
  const typeNames = new Map(ticketTypes.map((type) => [type.id, type.name]))
  const families = new Map<
    string,
    { name: string; email: string; phone: string; tickets: string[] }
  >()
  for (const row of attendees) {
    const type = ticketTypes.find((item) => item.name === row.ticketTypeName)
    if (!type || !kidsTypeIds.has(type.id)) continue
    const email = row.purchaserEmail?.trim().toLowerCase() || ""
    if (!email) continue
    const current = families.get(email) || {
      name: row.purchaserName || email,
      email: row.purchaserEmail || email,
      phone: row.purchaserPhone || "",
      tickets: [],
    }
    const label = typeNames.get(type.id) || row.ticketTypeName
    if (!current.tickets.includes(label)) current.tickets.push(label)
    if (!current.phone && row.purchaserPhone) current.phone = row.purchaserPhone
    families.set(email, current)
  }
  return { success: true as const, families: [...families.values()] }
}

export async function sendKidsProgramMessageAction(input: {
  eventId: string
  subject: string
  message: string
}): Promise<ActionResult & { sent?: number }> {
  const access = await requirePlanningAccess(input.eventId)
  if (!access.ok) return { success: false, error: access.error }
  const subject = input.subject.trim()
  const message = input.message.trim()
  if (!subject || !message) return { success: false, error: "Enter a subject and a message." }

  const familiesResult = await listKidsProgramFamiliesAction(input.eventId)
  if (!familiesResult.success) return familiesResult
  const emails = familiesResult.families.map((family) => family.email).filter(Boolean)
  if (emails.length === 0) return { success: false, error: "No kids-program families to email." }

  const supabase = await createClient()
  const { data: chosen } = await supabase
    .from("event_planning_quotes")
    .select("status, event_planning_places!inner(kind, waiver_url, name)")
    .eq("internal_event_id", input.eventId)
    .eq("status", "chosen")
  const waiver = (chosen || [])
    .map((row) => {
      const place = row.event_planning_places as
        | { kind: string; waiver_url: string | null; name: string }
        | { kind: string; waiver_url: string | null; name: string }[]
      return Array.isArray(place) ? place[0] : place
    })
    .find((place) => place?.kind === "kids_venue" && place.waiver_url)

  const waiverLine = waiver?.waiver_url
    ? `\n\nWaiver for ${waiver.name}: ${waiver.waiver_url}`
    : ""
  const text = `${message}${waiverLine}`
  const result = await sendTransactionalEmail({
    to: emails,
    subject,
    text,
    html: `<p>${text.replaceAll("\n", "<br />")}</p>`,
  })
  const sent = result.results.filter((row) => row.sent).length
  if (sent === 0) {
    return {
      success: false,
      error: result.configured
        ? "The email provider did not accept the message."
        : "Email is not configured, so the message was not delivered.",
    }
  }
  return { success: true, sent }
}

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

import {
  signUpReportEvent,
  signUpReportSlotAndTime,
  type SignUpReportVolunteer,
} from "@/lib/sign-ups/sign-up-reports"

function isMissingColumnError(error: { message?: string; code?: string } | null) {
  const message = (error?.message || "").toLowerCase()
  return (
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    (message.includes("column") && message.includes("does not exist"))
  )
}

type ContactEmbed = {
  full_name?: string | null
  email?: string | null
  phone?: string | null
}

type ParticipationRow = {
  id: string
  source_id: string
  volunteer_role: string | null
  assignment_meta?: unknown
  contacts: ContactEmbed | ContactEmbed[] | null
}

type EventRow = {
  id: string
  name: string | null
  source_module?: string | null
}

type BazaarRow = {
  id: string
  name: string | null
  internal_event_id: string | null
}

function contactFromEmbed(
  value: ContactEmbed | ContactEmbed[] | null
): ContactEmbed | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

export async function getSignUpReportVolunteers(): Promise<SignUpReportVolunteer[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const participationSelect =
    "id, source_id, volunteer_role, assignment_meta, contacts ( full_name, email, phone )"

  let participationsResult = await supabase
    .from("service_participations")
    .select(participationSelect)
    .eq("organization_id", organizationId)
    .eq("source_type", "internal_event")
    .eq("participation_type", "volunteer")
    .in("status", ["pending", "confirmed"])

  if (isMissingColumnError(participationsResult.error)) {
    participationsResult = await supabase
      .from("service_participations")
      .select(
        "id, source_id, volunteer_role, contacts ( full_name, email, phone )"
      )
      .eq("organization_id", organizationId)
      .eq("source_type", "internal_event")
      .eq("participation_type", "volunteer")
      .in("status", ["pending", "confirmed"])
  }

  if (participationsResult.error) {
    console.error(
      "getSignUpReportVolunteers:",
      participationsResult.error.message
    )
    return []
  }

  const participations = (participationsResult.data || []) as ParticipationRow[]
  if (participations.length === 0) return []

  const eventIds = [...new Set(participations.map((row) => row.source_id))]
  const eventSelect = "id, name, source_module"

  let eventsResult = await supabase
    .from("internal_events")
    .select(eventSelect)
    .eq("organization_id", organizationId)
    .in("id", eventIds)

  if (isMissingColumnError(eventsResult.error)) {
    eventsResult = await supabase
      .from("internal_events")
      .select("id, name")
      .eq("organization_id", organizationId)
      .in("id", eventIds)
  }

  if (eventsResult.error) {
    console.error("getSignUpReportVolunteers events:", eventsResult.error.message)
    return []
  }

  const bazaarsResult = await supabase
    .from("vendor_hub_events")
    .select("id, name, internal_event_id")
    .eq("organization_id", organizationId)
    .in("internal_event_id", eventIds)

  if (bazaarsResult.error) {
    console.error("getSignUpReportVolunteers bazaars:", bazaarsResult.error.message)
  }

  const eventsById = new Map<string, EventRow>()
  for (const event of (eventsResult.data || []) as EventRow[]) {
    eventsById.set(event.id, event)
  }

  const bazaarByInternalId = new Map<string, BazaarRow>()
  for (const bazaar of (bazaarsResult.data || []) as BazaarRow[]) {
    if (bazaar.internal_event_id) {
      bazaarByInternalId.set(bazaar.internal_event_id, bazaar)
    }
  }

  const rows: SignUpReportVolunteer[] = participations.flatMap((row) => {
    const event = eventsById.get(row.source_id)
    if (!event) return []
    const bazaar = bazaarByInternalId.get(event.id)
    const named = signUpReportEvent({
      eventId: event.id,
      eventName: event.name,
      sourceModule: event.source_module ?? null,
      bazaarId: bazaar?.id ?? null,
      bazaarName: bazaar?.name ?? null,
    })
    const contact = contactFromEmbed(row.contacts)
    const { slot, time } = signUpReportSlotAndTime({
      volunteerRole: row.volunteer_role,
      assignmentMeta: row.assignment_meta,
    })

    return [
      {
        id: row.id,
        eventName: named.eventName,
        eventHref: named.eventHref,
        volunteerName: contact?.full_name?.trim() || "Unknown",
        email: contact?.email?.trim() || null,
        phone: contact?.phone?.trim() || null,
        slot,
        time,
      },
    ]
  })

  rows.sort((left, right) => {
    const byEvent = left.eventName.localeCompare(right.eventName)
    if (byEvent !== 0) return byEvent
    const byTime = (left.time || "").localeCompare(right.time || "")
    if (byTime !== 0) return byTime
    return left.volunteerName.localeCompare(right.volunteerName)
  })

  return rows
}

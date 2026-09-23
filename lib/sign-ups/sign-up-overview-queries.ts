import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

import {
  isSignUpOverviewStatusVisible,
  signUpOverviewSource,
  volunteerSlotsNeeded,
  type SignUpOverviewEvent,
} from "@/lib/sign-ups/sign-up-overview"

function isMissingColumnError(error: { message?: string; code?: string } | null) {
  const message = (error?.message || "").toLowerCase()
  return (
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    (message.includes("column") && message.includes("does not exist"))
  )
}

type EventRow = {
  id: string
  name: string | null
  start_at: string | null
  end_at: string | null
  location_label: string | null
  status: string | null
  source_module?: string | null
  service_requirements?: unknown
}

type BazaarRow = {
  id: string
  name: string | null
  internal_event_id: string | null
  location: string | null
}

export async function getSignUpOverviewEvents(): Promise<SignUpOverviewEvent[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return []

  const eventSelect =
    "id, name, start_at, end_at, location_label, status, source_module, service_requirements"

  let eventsResult = await supabase
    .from("internal_events")
    .select(eventSelect)
    .eq("organization_id", organizationId)
    .eq("requires_volunteers", true)

  if (isMissingColumnError(eventsResult.error)) {
    eventsResult = await supabase
      .from("internal_events")
      .select(
        "id, name, start_at, end_at, location_label, status, service_requirements"
      )
      .eq("organization_id", organizationId)
      .eq("requires_volunteers", true)
  }

  if (eventsResult.error) {
    console.error("getSignUpOverviewEvents:", eventsResult.error.message)
    return []
  }

  const events = ((eventsResult.data || []) as EventRow[]).filter((event) =>
    isSignUpOverviewStatusVisible(event.status)
  )
  if (events.length === 0) return []

  const eventIds = events.map((event) => event.id)
  const [bazaarsResult, assignmentsResult] = await Promise.all([
    supabase
      .from("vendor_hub_events")
      .select("id, name, internal_event_id, location")
      .eq("organization_id", organizationId)
      .in("internal_event_id", eventIds),
    supabase
      .from("service_participations")
      .select("source_id, status")
      .eq("organization_id", organizationId)
      .eq("source_type", "internal_event")
      .eq("participation_type", "volunteer")
      .in("source_id", eventIds)
      .in("status", ["pending", "confirmed"]),
  ])

  if (bazaarsResult.error) {
    console.error("getSignUpOverviewEvents bazaars:", bazaarsResult.error.message)
  }
  if (assignmentsResult.error) {
    console.error(
      "getSignUpOverviewEvents assignments:",
      assignmentsResult.error.message
    )
  }

  const bazaarByInternalId = new Map<string, BazaarRow>()
  for (const row of (bazaarsResult.data || []) as BazaarRow[]) {
    if (row.internal_event_id) {
      bazaarByInternalId.set(row.internal_event_id, row)
    }
  }

  const filledByEventId = new Map<string, number>()
  for (const row of assignmentsResult.data || []) {
    const sourceId = row.source_id as string
    filledByEventId.set(sourceId, (filledByEventId.get(sourceId) || 0) + 1)
  }

  const rows: SignUpOverviewEvent[] = events.map((event) => {
    const bazaar = bazaarByInternalId.get(event.id)
    const source = bazaar
      ? "vendor-hub"
      : signUpOverviewSource(event.source_module)
    const name =
      (source === "vendor-hub" ? bazaar?.name : event.name)?.trim() ||
      event.name?.trim() ||
      "Untitled event"

    return {
      id: event.id,
      name,
      source,
      href:
        source === "vendor-hub" && bazaar
          ? VENDOR_HUB_ROUTES.events.detail(bazaar.id)
          : `/event-management/${event.id}`,
      startAt: event.start_at,
      endAt: event.end_at,
      location:
        event.location_label?.trim() ||
        bazaar?.location?.trim() ||
        null,
      status: event.status || "draft",
      volunteersFilled: filledByEventId.get(event.id) || 0,
      volunteersNeeded: volunteerSlotsNeeded(event.service_requirements),
    }
  })

  rows.sort((left, right) => {
    const leftTime = left.startAt ? new Date(left.startAt).getTime() : Number.MAX_SAFE_INTEGER
    const rightTime = right.startAt
      ? new Date(right.startAt).getTime()
      : Number.MAX_SAFE_INTEGER
    if (leftTime !== rightTime) return leftTime - rightTime
    return left.name.localeCompare(right.name)
  })

  return rows
}

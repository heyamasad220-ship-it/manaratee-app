import type { SupabaseClient } from "@supabase/supabase-js"

import { INTERNAL_EVENT_STATUSES } from "@/lib/events/internal-event-status"
import { INTERNAL_EVENT_SOURCE_MODULE } from "@/lib/events/internal-event-source"
import { wallTimeToIso } from "@/lib/events/event-datetime"
import { calendarStatusFromVisibility } from "@/lib/community-calendar/calendar-visibility"
import type { CommunityCalendarVisibility } from "@/lib/community-calendar/calendar-visibility"

export type BazaarInternalEventIdentity = {
  name: string
  description: string | null
  eventDate: string | null
  startTime: string | null
  endTime: string | null
  location: string | null
  flyerUrl: string | null
  /** Primary space. Used when `venueIds` is omitted. */
  venueId: string | null
  /** Every on-site space. Empty means off-site. */
  venueIds?: string[] | null
  calendarVisibility: CommunityCalendarVisibility
  coordinatorContactId?: string | null
}

async function resolveBazaarDepartmentId(
  supabase: SupabaseClient,
  organizationId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("departments")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })

  if (error) throw new Error(error.message)
  const rows = data || []
  const preferred = rows.find((row) => {
    const name = ((row.name as string) || "").trim().toLowerCase()
    return name === "center" || name === "administration" || name === "admin"
  })
  const id = (preferred?.id as string | undefined) || (rows[0]?.id as string | undefined)
  if (!id) {
    throw new Error("Create a department before creating a bazaar event.")
  }
  return id
}

async function resolveCommunityEventTypeId(
  supabase: SupabaseClient,
  organizationId: string
): Promise<string> {
  const { data: existing, error } = await supabase
    .from("event_types")
    .select("id, slug")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error) throw new Error(error.message)
  const community = (existing || []).find((row) => row.slug === "community")
  if (community?.id) return community.id as string
  if (existing?.[0]?.id) return existing[0].id as string

  const { data: created, error: createError } = await supabase
    .from("event_types")
    .insert({
      organization_id: organizationId,
      name: "Community Event",
      slug: "community",
      sort_order: 30,
      is_active: true,
    })
    .select("id")
    .single()

  if (createError || !created?.id) {
    throw new Error(createError?.message || "Could not create a community event type.")
  }
  return created.id as string
}

function identityTimestamps(identity: BazaarInternalEventIdentity) {
  const startAt = wallTimeToIso(identity.eventDate, identity.startTime)
  const endAt =
    wallTimeToIso(identity.eventDate, identity.endTime) ||
    (startAt
      ? new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString()
      : null)
  return { startAt, endAt }
}

function eventStatusForBazaar(endAt: string | null, startAt: string | null) {
  const now = Date.now()
  const endMs = endAt ? new Date(endAt).getTime() : NaN
  const startMs = startAt ? new Date(startAt).getTime() : NaN
  if (Number.isFinite(endMs) && endMs < now) return INTERNAL_EVENT_STATUSES.completed
  if (Number.isFinite(startMs) && startMs < now) return INTERNAL_EVENT_STATUSES.completed
  return INTERNAL_EVENT_STATUSES.draft
}

function bazaarWorkspaceFeatures(existing: unknown) {
  const current =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {}
  return { ...current, vendors: true, youth: false, registration: false }
}

function isReusableBazaarHold(row: {
  source_module?: string | null
  requires_ticketing?: boolean | null
  requires_childcare?: boolean | null
  campaign_id?: string | null
}) {
  if (row.source_module === INTERNAL_EVENT_SOURCE_MODULE.vendorHub) return true
  return (
    row.requires_ticketing !== true &&
    row.requires_childcare !== true &&
    !row.campaign_id
  )
}

function venueIdsFromIdentity(identity: BazaarInternalEventIdentity) {
  const fromList = (identity.venueIds || [])
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
  if (fromList.length > 0) return [...new Set(fromList)]
  const single = identity.venueId?.trim()
  return single ? [single] : []
}

async function syncVenues(options: {
  supabase: SupabaseClient
  organizationId: string
  eventId: string
  venueIds: string[]
}) {
  const { supabase, organizationId, eventId, venueIds } = options
  await supabase
    .from("internal_event_venues")
    .delete()
    .eq("organization_id", organizationId)
    .eq("internal_event_id", eventId)

  if (venueIds.length > 0) {
    const { error } = await supabase.from("internal_event_venues").insert(
      venueIds.map((venueId) => ({
        organization_id: organizationId,
        internal_event_id: eventId,
        venue_id: venueId,
      }))
    )
    if (error) throw new Error(error.message)
  }

  // Calendar sync reads the junction from the internal_events trigger.
  const { error: touchError } = await supabase
    .from("internal_events")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("organization_id", organizationId)

  if (touchError) throw new Error(touchError.message)
}

async function applyIdentityToInternalEvent(options: {
  supabase: SupabaseClient
  organizationId: string
  eventId: string
  identity: BazaarInternalEventIdentity
  existingWorkspaceFeatures?: unknown
}) {
  const { startAt, endAt } = identityTimestamps(options.identity)
  const communityCalendarStatus = calendarStatusFromVisibility(
    options.identity.calendarVisibility
  )
  const venueIds = venueIdsFromIdentity(options.identity)
  const venueId = venueIds[0] || null

  const { error } = await options.supabase
    .from("internal_events")
    .update({
      name: options.identity.name,
      description: options.identity.description,
      start_at: startAt,
      end_at: endAt,
      location_label: options.identity.location,
      location_type: venueId ? "facility" : "external",
      venue_id: venueId,
      flyer_url: options.identity.flyerUrl,
      community_calendar_status: communityCalendarStatus,
      source_module: INTERNAL_EVENT_SOURCE_MODULE.vendorHub,
      requires_vendors: false,
      requires_childcare: false,
      requires_ticketing: false,
      workspace_features: bazaarWorkspaceFeatures(options.existingWorkspaceFeatures),
      coordinator_contact_id: options.identity.coordinatorContactId || null,
      timezone: "America/Chicago",
    })
    .eq("id", options.eventId)
    .eq("organization_id", options.organizationId)

  if (error) throw new Error(error.message)

  await syncVenues({
    supabase: options.supabase,
    organizationId: options.organizationId,
    eventId: options.eventId,
    venueIds,
  })
}

/**
 * Keeps a lightweight date/place row on `internal_events` so on-site bazaars
 * can hold a facility space and appear on Community Calendar. That row is not
 * an Event Management workspace.
 */
export async function ensureBazaarInternalEvent(options: {
  supabase: SupabaseClient
  organizationId: string
  identity: BazaarInternalEventIdentity
  internalEventId?: string | null
}): Promise<string> {
  const requestedId = options.internalEventId?.trim() || null
  if (requestedId && requestedId !== "new" && requestedId !== "none") {
    const { data, error } = await options.supabase
      .from("internal_events")
      .select(
        "id, workspace_features, source_module, requires_ticketing, requires_childcare, campaign_id"
      )
      .eq("organization_id", options.organizationId)
      .eq("id", requestedId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (data && isReusableBazaarHold(data)) {
      await applyIdentityToInternalEvent({
        supabase: options.supabase,
        organizationId: options.organizationId,
        eventId: requestedId,
        identity: options.identity,
        existingWorkspaceFeatures: data.workspace_features,
      })
      return requestedId
    }
  }

  const departmentId = await resolveBazaarDepartmentId(
    options.supabase,
    options.organizationId
  )
  const eventTypeId = await resolveCommunityEventTypeId(
    options.supabase,
    options.organizationId
  )
  const { startAt, endAt } = identityTimestamps(options.identity)
  const venueIds = venueIdsFromIdentity(options.identity)
  const venueId = venueIds[0] || null

  const { data, error } = await options.supabase
    .from("internal_events")
    .insert({
      organization_id: options.organizationId,
      department_id: departmentId,
      event_type_id: eventTypeId,
      name: options.identity.name,
      description: options.identity.description,
      status: eventStatusForBazaar(endAt, startAt),
      start_at: startAt,
      end_at: endAt,
      location_type: venueId ? "facility" : "external",
      location_label: options.identity.location,
      venue_id: venueId,
      flyer_url: options.identity.flyerUrl,
      community_calendar_status: calendarStatusFromVisibility(
        options.identity.calendarVisibility
      ),
      source_module: INTERNAL_EVENT_SOURCE_MODULE.vendorHub,
      requires_vendors: false,
      requires_childcare: false,
      requires_ticketing: false,
      workspace_features: bazaarWorkspaceFeatures(null),
      coordinator_contact_id: options.identity.coordinatorContactId || null,
      timezone: "America/Chicago",
    })
    .select("id")
    .single()

  if (error || !data?.id) {
    throw new Error(error?.message || "Failed to create the bazaar facility hold.")
  }

  await syncVenues({
    supabase: options.supabase,
    organizationId: options.organizationId,
    eventId: data.id as string,
    venueIds,
  })

  return data.id as string
}

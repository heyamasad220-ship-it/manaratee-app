"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"
import { getOperationalBriefBySource } from "@/lib/operational-briefs/operational-brief-queries"
import { OPERATIONAL_BRIEF_SOURCE_TYPES } from "@/lib/operational-briefs/operational-brief-types"
import { getEventTicketTypes } from "@/lib/tickets/ticket-type-actions"
import { ticketingFormFromEvent } from "@/lib/tickets/ticket-types"
import {
  serviceRequirementsFormFromEvent,
  type EventServiceRequirementsFormState,
} from "@/lib/events/event-service-requirements"
import type { EventTicketingFormState } from "@/lib/tickets/ticket-types"
import {
  getInternalEventById,
  getInternalEventVenueIds,
} from "@/lib/events/internal-event-queries"
import {
  inferInternalEventLocationType,
  isInternalEventLocationType,
  type InternalEventLocationType,
} from "@/lib/events/internal-event-location"
import {
  calendarDateKey,
  normalizeEventRecurrenceConfig,
  type EventRecurrenceConfig,
} from "@/lib/events/event-recurrence"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { userCanSubmitInternalEventRequest } from "@/lib/auth/staff-tools-eligibility"
import { INTERNAL_EVENT_STATUSES } from "@/lib/events/internal-event-status"

export type FacilityEventEditPayload = {
  id: string
  name: string
  description: string
  departmentId: string
  eventTypeId: string
  locationType: InternalEventLocationType
  venueIds: string[]
  locationLabel: string
  locationAddress: string
  startAt: string | null
  endAt: string | null
  status: string
  recurrence: EventRecurrenceConfig | null
  serviceRequirements: EventServiceRequirementsFormState
  ticketing: EventTicketingFormState
  expectedAttendance: string
  setupStyle: string
  roomSetupNotes: string
  canEdit: boolean
  seriesDateKeys: string[]
}

export async function getFacilityEventEditPayload(
  eventId: string
): Promise<FacilityEventEditPayload | null> {
  const organizationId =
    (await getSelectedOrganizationId()) || (await resolveOrganizationId())

  if (!organizationId) {
    return null
  }

  const event = await getInternalEventById(eventId)
  if (!event) {
    return null
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const canManage = await hasAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )
  const canSubmit = user
    ? await userCanSubmitInternalEventRequest(supabase, organizationId, user.id)
    : false
  const isPendingOwner =
    Boolean(user?.id) &&
    event.created_by === user?.id &&
    event.status === INTERNAL_EVENT_STATUSES.awaitingApproval

  const canEdit = canManage || (canSubmit && isPendingOwner)

  const [venueIds, ticketTypes, brief] = await Promise.all([
    getInternalEventVenueIds(event.id),
    getEventTicketTypes(event.id),
    getOperationalBriefBySource(
      OPERATIONAL_BRIEF_SOURCE_TYPES.internalEvent,
      event.id
    ),
  ])

  const resolvedVenueIds =
    venueIds.length > 0 ? venueIds : event.venue_id ? [event.venue_id] : []

  const recurrence = normalizeEventRecurrenceConfig(event.recurrence_config)
  const seriesId = recurrence?.seriesId?.trim() || ""
  const timeZone = event.timezone || "America/Chicago"
  const seriesDateKeys = new Set<string>()
  if (event.start_at) {
    const key = calendarDateKey(event.start_at, timeZone)
    if (key) seriesDateKeys.add(key)
  }
  for (const key of recurrence?.customDates || []) seriesDateKeys.add(key)
  if (seriesId) {
    const { data: siblings } = await supabase
      .from("internal_events")
      .select("start_at")
      .eq("organization_id", organizationId)
      .contains("recurrence_config", { seriesId })
    for (const row of siblings || []) {
      const key = calendarDateKey(
        (row as { start_at?: string | null }).start_at,
        timeZone
      )
      if (key) seriesDateKeys.add(key)
    }
  }

  const inferred = inferInternalEventLocationType(event)
  const locationType: InternalEventLocationType = isInternalEventLocationType(
    inferred
  )
    ? inferred
    : isInternalEventLocationType(event.location_type)
      ? event.location_type
      : resolvedVenueIds.length > 0
        ? "facility"
        : "online"

  return {
    id: event.id,
    name: event.name,
    description: event.description || "",
    departmentId: event.department_id,
    eventTypeId: event.event_type_id,
    locationType,
    venueIds: resolvedVenueIds,
    locationLabel:
      locationType === "external" ? event.location_label || "" : "",
    locationAddress:
      locationType === "external" || locationType === "online"
        ? event.location_address || ""
        : "",
    startAt: event.start_at,
    endAt: event.end_at,
    status: event.status,
    recurrence,
    seriesDateKeys: [...seriesDateKeys].sort(),
    serviceRequirements: serviceRequirementsFormFromEvent(event),
    ticketing: ticketingFormFromEvent({
      requires_ticketing: event.requires_ticketing,
      ticketing_config: event.ticketing_config,
      ticketTypes,
    }),
    expectedAttendance:
      brief?.expected_attendance != null ? String(brief.expected_attendance) : "",
    setupStyle: brief?.setup_style || "",
    roomSetupNotes: brief?.room_setup_notes || "",
    canEdit,
  }
}

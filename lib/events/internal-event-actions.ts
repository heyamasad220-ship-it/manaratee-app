"use server"

import { revalidatePath } from "next/cache"

import { syncOperationalBriefForInternalEvent } from "@/lib/operational-briefs/operational-brief-queries"
import type { OperationalSetupInput } from "@/lib/operational-briefs/operational-setup-input"
import {
  buildServiceRequirementsPayload,
  type EventServiceRequirements,
  type EventServiceRequirementsFormState,
} from "./event-service-requirements"
import { syncEventTicketTypes } from "@/lib/tickets/ticket-type-actions"
import {
  buildTicketingPayload,
  type EventTicketTypeInput,
  type EventTicketingConfig,
  type EventTicketingFormState,
} from "@/lib/tickets/ticket-types"
import { revalidateTicketingPaths } from "@/lib/tickets/revalidate-ticketing-paths"
import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { userCanSubmitInternalEventRequest } from "@/lib/auth/staff-tools-eligibility"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { getConflictingReservations } from "@/lib/reservations/reservation-queries"
import { fireModuleNotifications } from "@/lib/notifications/dispatch-module-notification"

import { buildCopyName } from "@/lib/programs/program-fee-plan-copy-utils"
import {
  calendarStatusFromVisibility,
  type CommunityCalendarVisibility,
} from "@/lib/community-calendar/calendar-visibility"
import { COMMUNITY_CALENDAR_PATH } from "@/lib/community-calendar/routes"

import type { InternalEventStatus } from "./internal-event-status"
import { INTERNAL_EVENT_STATUSES } from "./internal-event-status"
import {
  INTERNAL_EVENT_LOCATION_TYPES,
  isInternalEventLocationType,
  type InternalEventLocationType,
} from "./internal-event-location"
import {
  getInternalEventRecordById,
  getInternalEventVenueIds,
} from "./internal-event-queries"
import {
  expandEventOccurrences,
  normalizeEventRecurrenceConfig,
  type EventRecurrenceConfig,
} from "./event-recurrence"
import {
  parseAttendanceMode,
  parseEventWorkspaceFeatures,
  resolveAttendanceMode,
  resolveEventWorkspaceFeatures,
  type EventAttendanceMode,
  type EventWorkspaceFeatures,
} from "./event-workspace-features"

export type InternalEventCatalogActionResult =
  | { success: true; eventId?: string }
  | { success: false; error: string }

type CreateInternalEventInput = {
  name: string
  department_id: string
  event_type_id: string
  description?: string | null
  status?: InternalEventStatus
  start_at?: string | null
  end_at?: string | null
  venue_id?: string | null
  /** One or more facility spaces (facility location). Primary venue_id is derived from the first. */
  venue_ids?: string[] | null
  location_type?: InternalEventLocationType | null
  location_label?: string | null
  location_address?: string | null
  timezone?: string | null
  requires_volunteers?: boolean
  requires_childcare?: boolean
  requires_vendors?: boolean
  requires_ticketing?: boolean
  service_requirements?: EventServiceRequirements
  ticketing_config?: EventTicketingConfig
  ticketTypes?: EventTicketTypeInput[]
  operationalSetup?: OperationalSetupInput
  /** Recurring series (materialized as one event row per occurrence). */
  recurrence_config?: EventRecurrenceConfig | Record<string, unknown> | null
}

type UpdateInternalEventInput = CreateInternalEventInput & {
  id: string
}

function emptyFacilityOperationalSetup(): OperationalSetupInput {
  return {
    expectedAttendance: null,
    setupStyle: null,
    roomSetupNotes: null,
    equipmentNotes: null,
    foodBeverageNotes: null,
    tableLinenNotes: null,
    cleanupNotes: null,
    accessibilityNotes: null,
    facilityNotes: null,
  }
}

function parseOptionalTimestamp(value: string | null | undefined) {
  if (!value || !value.trim()) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date or time.")
  }

  return parsed.toISOString()
}

function validateEventInput(input: CreateInternalEventInput) {
  const name = input.name.trim()
  if (!name) {
    throw new Error("Event name is required.")
  }

  if (!input.department_id) {
    throw new Error("Department is required.")
  }

  if (!input.event_type_id) {
    throw new Error("Event type is required.")
  }

  const startAt = parseOptionalTimestamp(input.start_at)
  const endAt = parseOptionalTimestamp(input.end_at)

  if (startAt && endAt && new Date(startAt) > new Date(endAt)) {
    throw new Error("End date must be after start date.")
  }

  const status = input.status || INTERNAL_EVENT_STATUSES.draft
  if (!Object.values(INTERNAL_EVENT_STATUSES).includes(status)) {
    throw new Error("Invalid event status.")
  }

  const locationType = input.location_type ?? null
  if (locationType != null && !isInternalEventLocationType(locationType)) {
    throw new Error("Invalid location type.")
  }

  let venueIds = Array.from(
    new Set(
      (input.venue_ids || [])
        .map((id) => id?.trim())
        .filter((id): id is string => Boolean(id))
    )
  )
  if (venueIds.length === 0 && input.venue_id) {
    venueIds = [input.venue_id]
  }

  let venueId = venueIds[0] || input.venue_id || null
  let locationLabel = input.location_label?.trim() || null
  let locationAddress = input.location_address?.trim() || null

  if (locationType === INTERNAL_EVENT_LOCATION_TYPES.facility) {
    if (venueIds.length === 0) {
      throw new Error("Select at least one facility venue.")
    }
    venueId = venueIds[0]
    locationAddress = null
  } else if (locationType === INTERNAL_EVENT_LOCATION_TYPES.online) {
    venueId = null
    venueIds = []
    locationLabel = "Online"
    // Meeting link is stored in location_address for online events.
    const rawLink =
      locationAddress ||
      (input.location_label && /^https?:\/\//i.test(input.location_label.trim())
        ? input.location_label.trim()
        : null)
    if (rawLink) {
      try {
        const parsed = new URL(rawLink)
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new Error("invalid")
        }
        locationAddress = parsed.toString()
      } catch {
        throw new Error("Meeting link must be a valid http(s) URL.")
      }
    } else {
      locationAddress = null
    }
  } else if (locationType === INTERNAL_EVENT_LOCATION_TYPES.external) {
    venueId = null
    venueIds = []
    if (!locationLabel) {
      throw new Error("External venue name is required.")
    }
    if (!locationAddress) {
      throw new Error("External venue address is required.")
    }
  } else {
    // Legacy unset — keep provided fields as-is (no invented type).
    locationAddress = locationAddress || null
  }

  return {
    name,
    department_id: input.department_id,
    event_type_id: input.event_type_id,
    description: input.description?.trim() || null,
    status,
    start_at: startAt,
    end_at: endAt,
    venue_id: venueId,
    venue_ids: venueIds,
    location_type: locationType,
    location_label: locationLabel,
    location_address: locationAddress,
    timezone: input.timezone?.trim() || null,
    requires_volunteers: input.requires_volunteers === true,
    requires_childcare: input.requires_childcare === true,
    requires_vendors: input.requires_vendors === true,
    requires_ticketing: input.requires_ticketing === true,
    service_requirements: input.service_requirements || {},
    ticketing_config: input.ticketing_config || {},
    recurrence_config: (() => {
      const normalized = normalizeEventRecurrenceConfig(input.recurrence_config)
      return normalized?.enabled ? normalized : null
    })(),
  }
}

function validateTicketingInput(input: CreateInternalEventInput) {
  if (!input.requires_ticketing) {
    return
  }

  const ticketTypes = input.ticketTypes || []
  const validTypes = ticketTypes.filter((type) => type.name.trim())

  if (validTypes.length === 0) {
    throw new Error("Add at least one ticket type when ticketing is enabled.")
  }

  for (const type of validTypes) {
    if (Number.isNaN(type.priceCents) || type.priceCents < 0) {
      throw new Error(`Ticket type "${type.name}" must have a valid price.`)
    }
    if (
      type.quantityTotal != null &&
      (Number.isNaN(type.quantityTotal) || type.quantityTotal < 0)
    ) {
      throw new Error(`Ticket type "${type.name}" must have a valid quantity.`)
    }
  }
}

async function syncTicketingForEvent(
  eventId: string,
  input: CreateInternalEventInput
) {
  if (!input.requires_ticketing) {
    await syncEventTicketTypes(eventId, [])
    return
  }

  await syncEventTicketTypes(eventId, input.ticketTypes || [])
}

async function assertVenueInOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  venueId: string | null | undefined
) {
  if (!venueId) {
    return
  }

  const { data, error } = await supabase
    .from("venues")
    .select("id")
    .eq("id", venueId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error || !data) {
    throw new Error("Selected venue is not valid for this organization.")
  }
}

async function assertVenuesInOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  venueIds: string[]
) {
  if (venueIds.length === 0) return

  const { data, error } = await supabase
    .from("venues")
    .select("id")
    .eq("organization_id", organizationId)
    .in("id", venueIds)

  if (error || !data || data.length !== venueIds.length) {
    throw new Error("One or more selected venues are not valid for this organization.")
  }
}

async function replaceInternalEventVenues(options: {
  supabase: Awaited<ReturnType<typeof createClient>>
  organizationId: string
  eventId: string
  venueIds: string[]
}) {
  const { supabase, organizationId, eventId, venueIds } = options

  const { error: deleteError } = await supabase
    .from("internal_event_venues")
    .delete()
    .eq("organization_id", organizationId)
    .eq("internal_event_id", eventId)

  if (deleteError) {
    console.error(deleteError)
    const message = String(deleteError.message || "")
    if (
      message.includes("internal_event_venues") ||
      message.includes("schema cache") ||
      deleteError.code === "42P01" ||
      deleteError.code === "PGRST205"
    ) {
      throw new Error(
        "Multi-venue table is missing. Run scripts/211_internal_event_multi_venues.sql in Supabase, then try again."
      )
    }
    throw new Error("Failed to update event venues.")
  }

  if (venueIds.length > 0) {
    const { error: insertError } = await supabase.from("internal_event_venues").insert(
      venueIds.map((venueId) => ({
        organization_id: organizationId,
        internal_event_id: eventId,
        venue_id: venueId,
      }))
    )

    if (insertError) {
      console.error(insertError)
      const message = String(insertError.message || "")
      if (
        message.includes("internal_event_venues") ||
        message.includes("schema cache") ||
        insertError.code === "42P01" ||
        insertError.code === "PGRST205"
      ) {
        throw new Error(
          "Multi-venue table is missing. Run scripts/211_internal_event_multi_venues.sql in Supabase, then try again."
        )
      }
      throw new Error("Failed to save event venues.")
    }
  }

  // Re-run calendar sync now that junction rows exist
  const { error: touchError } = await supabase
    .from("internal_events")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("organization_id", organizationId)

  if (touchError) {
    console.error(touchError)
  }
}

async function assertDepartmentInOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  departmentId: string
) {
  const { data, error } = await supabase
    .from("departments")
    .select("id")
    .eq("id", departmentId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error || !data) {
    throw new Error("Selected department is not valid for this organization.")
  }
}

async function assertEventTypeInOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  eventTypeId: string
) {
  const { data, error } = await supabase
    .from("event_types")
    .select("id")
    .eq("id", eventTypeId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle()

  if (error || !data) {
    throw new Error("Selected event type is not valid for this organization.")
  }
}

async function assertInternalEventSpacesAvailable(input: {
  organizationId: string
  venueIds: string[]
  startAt: string
  endAt: string
  excludeEventId?: string
}) {
  for (const venueId of input.venueIds) {
    const conflicts = await getConflictingReservations(
      input.organizationId,
      venueId,
      null,
      input.startAt,
      input.endAt
    )

    const blocking = input.excludeEventId
      ? conflicts.filter(
          (row) =>
            !(
              row.source_type === "internal_event" &&
              row.source_id === input.excludeEventId
            )
        )
      : conflicts

    if (blocking.length > 0) {
      throw new Error(
        "That space and time is unavailable because another rental, event, program, or hold is already scheduled. Please choose a different time."
      )
    }
  }
}

function revalidateInternalEventPaths(eventId?: string) {
  revalidatePath("/event-management")
  revalidatePath("/event-management/calendar")
  revalidatePath(COMMUNITY_CALENDAR_PATH)
  revalidatePath("/facilities/availability")
  revalidatePath("/facilities/calendar")
  revalidatePath("/facilities/reservation-center")
  revalidatePath("/facilities/overview")
  revalidateTicketingPaths()
  if (eventId) {
    revalidatePath(`/event-management/${eventId}`)
  }
}

export async function createInternalEvent(input: CreateInternalEventInput) {
  const canManage = await hasAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )
  if (!canManage) {
    throw new Error("You do not have permission to create events.")
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const payload = validateEventInput(input)
  validateTicketingInput(input)

  if (!payload.location_type) {
    throw new Error("Select where this event takes place.")
  }

  const { venue_ids: venueIds, ...eventPayload } = payload

  await assertDepartmentInOrg(supabase, organizationId, eventPayload.department_id)
  await assertEventTypeInOrg(supabase, organizationId, eventPayload.event_type_id)
  if (
    eventPayload.location_type === INTERNAL_EVENT_LOCATION_TYPES.facility &&
    venueIds.length > 0
  ) {
    await assertVenuesInOrg(supabase, organizationId, venueIds)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from("internal_events")
    .insert({
      organization_id: organizationId,
      ...eventPayload,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single()

  if (error) {
    console.error(error)
    throw new Error("Failed to create event")
  }

  await replaceInternalEventVenues({
    supabase,
    organizationId,
    eventId: data.id as string,
    venueIds,
  })

  await syncOperationalBriefForInternalEvent(data.id as string, organizationId, {
    operationalSetup:
      eventPayload.location_type === INTERNAL_EVENT_LOCATION_TYPES.facility
        ? input.operationalSetup
        : emptyFacilityOperationalSetup(),
  })

  await syncTicketingForEvent(data.id as string, input)

  revalidateInternalEventPaths(data.id as string)

  return data.id as string
}

export async function submitInternalEventRequest(input: CreateInternalEventInput) {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("You must be signed in to submit event requests.")
  }

  const canSubmit = await userCanSubmitInternalEventRequest(
    supabase,
    organizationId,
    user.id
  )

  if (!canSubmit) {
    throw new Error("You do not have permission to submit event requests.")
  }

  if (!input.location_type || !isInternalEventLocationType(input.location_type)) {
    throw new Error("Select Center, Online, or External Venue.")
  }

  // Center (facility) needs approval to coordinate spaces. Online / External Venue
  // do not use the building, so they confirm on submit.
  const isFacility =
    input.location_type === INTERNAL_EVENT_LOCATION_TYPES.facility
  const submitStatus = isFacility
    ? INTERNAL_EVENT_STATUSES.awaitingApproval
    : INTERNAL_EVENT_STATUSES.confirmed

  const payload = validateEventInput({
    ...input,
    status: submitStatus,
  })
  validateTicketingInput(input)

  const {
    venue_ids: venueIds,
    recurrence_config: recurrenceConfig,
    ...eventPayload
  } = payload

  if (!eventPayload.start_at || !eventPayload.end_at) {
    throw new Error("Start and end times are required to submit an event request.")
  }

  if (isFacility && venueIds.length === 0) {
    throw new Error("Select at least one venue to submit an event request.")
  }

  await assertDepartmentInOrg(supabase, organizationId, eventPayload.department_id)
  await assertEventTypeInOrg(supabase, organizationId, eventPayload.event_type_id)
  if (isFacility) {
    await assertVenuesInOrg(supabase, organizationId, venueIds)
  }

  const startDate = new Date(eventPayload.start_at)
  const endDate = new Date(eventPayload.end_at)
  let occurrences = expandEventOccurrences(startDate, endDate, recurrenceConfig)

  if (occurrences.length === 0) {
    throw new Error("No occurrences to schedule. Check recurrence rules and exceptions.")
  }

  if (isFacility) {
    for (const occurrence of occurrences) {
      await assertInternalEventSpacesAvailable({
        organizationId,
        venueIds,
        startAt: occurrence.startAt.toISOString(),
        endAt: occurrence.endAt.toISOString(),
      })
    }
  }

  const seriesId =
    occurrences.length > 1
      ? crypto.randomUUID()
      : recurrenceConfig?.enabled
        ? crypto.randomUUID()
        : null

  const storedRecurrence =
    recurrenceConfig?.enabled && seriesId
      ? { ...recurrenceConfig, seriesId, enabled: true }
      : recurrenceConfig?.enabled
        ? { ...recurrenceConfig, enabled: true }
        : null

  const nowIso = new Date().toISOString()
  const createdIds: string[] = []

  for (const occurrence of occurrences) {
    const { data, error } = await supabase
      .from("internal_events")
      .insert({
        organization_id: organizationId,
        ...eventPayload,
        start_at: occurrence.startAt.toISOString(),
        end_at: occurrence.endAt.toISOString(),
        status: submitStatus,
        submitted_at: nowIso,
        approved_at: isFacility ? null : nowIso,
        created_by: user.id,
        recurrence_config: storedRecurrence,
      })
      .select("id")
      .single()

    if (error) {
      console.error("submitInternalEventRequest insert failed", error)
      const detail = [error.message, error.details, error.hint]
        .filter(Boolean)
        .join(" — ")
      const lower = detail.toLowerCase()
      if (
        lower.includes("location_type") ||
        lower.includes("location_address")
      ) {
        throw new Error(
          "Database is missing location columns. Run scripts/210_internal_event_location_type.sql in Supabase, then try again."
        )
      }
      if (lower.includes("recurrence_config")) {
        throw new Error(
          "Database could not save recurrence. Check that internal_events.recurrence_config exists, then try again."
        )
      }
      throw new Error(
        detail
          ? `Failed to submit event request: ${detail}`
          : "Failed to submit event request."
      )
    }

    const eventId = data.id as string
    createdIds.push(eventId)

    if (isFacility) {
      await replaceInternalEventVenues({
        supabase,
        organizationId,
        eventId,
        venueIds,
      })
    }

    await syncOperationalBriefForInternalEvent(eventId, organizationId, {
      operationalSetup: isFacility ? input.operationalSetup : emptyFacilityOperationalSetup(),
    })

    await syncTicketingForEvent(eventId, input)
  }

  const primaryId = createdIds[0]

  if (isFacility) {
    fireModuleNotifications([
      {
        organizationId,
        moduleKey: "event_management",
        audience: "staff",
        eventKey: "request_submitted",
        subject: "New internal event request",
        summary:
          createdIds.length > 1
            ? `A staff member submitted a recurring Center event request (${createdIds.length} occurrences).`
            : "A staff member submitted a new Center event request for facility approval.",
        metadata: {
          eventId: primaryId,
          eventIds: createdIds,
          seriesId,
          submittedBy: user.id,
        },
      },
      {
        organizationId,
        moduleKey: "event_management",
        audience: "customer",
        eventKey: "request_received",
        subject: "Event request received",
        summary:
          "Your Center event request was received and is awaiting facility review.",
        metadata: {
          eventId: primaryId,
          eventIds: createdIds,
          seriesId,
          submittedBy: user.id,
        },
      },
    ])
  } else {
    fireModuleNotifications([
      {
        organizationId,
        moduleKey: "event_management",
        audience: "staff",
        eventKey: "request_submitted",
        subject: "New event created",
        summary:
          createdIds.length > 1
            ? `A staff member created a recurring Online/External event (${createdIds.length} occurrences).`
            : "A staff member created an Online or External Venue event (no facility approval required).",
        metadata: {
          eventId: primaryId,
          eventIds: createdIds,
          seriesId,
          submittedBy: user.id,
          autoConfirmed: true,
        },
      },
      {
        organizationId,
        moduleKey: "event_management",
        audience: "customer",
        eventKey: "request_approved",
        subject: "Event confirmed",
        summary: "Your Online or External Venue event is confirmed.",
        metadata: {
          eventId: primaryId,
          eventIds: createdIds,
          seriesId,
          submittedBy: user.id,
          autoConfirmed: true,
        },
      },
    ])
  }

  for (const id of createdIds) {
    revalidateInternalEventPaths(id)
  }

  return primaryId
}

export async function approveInternalEventRequest(eventId: string) {
  const canManage = await hasAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )
  if (!canManage) {
    throw new Error("You do not have permission to approve event requests.")
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const event = await getInternalEventRecordById(eventId)

  if (!event) {
    throw new Error("Event request not found.")
  }

  if (
    event.status !== INTERNAL_EVENT_STATUSES.awaitingApproval &&
    event.status !== INTERNAL_EVENT_STATUSES.submitted
  ) {
    throw new Error("Only pending event requests can be approved.")
  }

  if (event.start_at && event.end_at) {
    const { data: venueRows } = await supabase
      .from("internal_event_venues")
      .select("venue_id")
      .eq("organization_id", organizationId)
      .eq("internal_event_id", eventId)

    const venueIds = (venueRows || [])
      .map((row) => row.venue_id as string)
      .filter(Boolean)

    const checkIds =
      venueIds.length > 0 ? venueIds : event.venue_id ? [event.venue_id] : []

    if (checkIds.length > 0) {
      await assertInternalEventSpacesAvailable({
        organizationId,
        venueIds: checkIds,
        startAt: event.start_at,
        endAt: event.end_at,
        excludeEventId: eventId,
      })
    }
  }

  const nowIso = new Date().toISOString()

  const { error } = await supabase
    .from("internal_events")
    .update({
      status: INTERNAL_EVENT_STATUSES.confirmed,
      approved_at: nowIso,
    })
    .eq("id", eventId)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error("Failed to approve event request")
  }

  await syncOperationalBriefForInternalEvent(eventId, organizationId)

  fireModuleNotifications([
    {
      organizationId,
      moduleKey: "event_management",
      audience: "staff",
      eventKey: "request_approved",
      subject: "Internal event approved",
      summary: "An internal event request was approved.",
      metadata: { eventId },
    },
    {
      organizationId,
      moduleKey: "event_management",
      audience: "customer",
      eventKey: "request_approved",
      subject: "Event request approved",
      summary: "Your internal event request was approved.",
      metadata: { eventId },
    },
  ])

  revalidateInternalEventPaths(eventId)
}

export async function declineInternalEventRequest(input: {
  eventId: string
  declineReason?: string | null
}) {
  const canManage = await hasAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )
  if (!canManage) {
    throw new Error("You do not have permission to decline event requests.")
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const event = await getInternalEventRecordById(input.eventId)

  if (!event) {
    throw new Error("Event request not found.")
  }

  if (
    event.status !== INTERNAL_EVENT_STATUSES.awaitingApproval &&
    event.status !== INTERNAL_EVENT_STATUSES.submitted
  ) {
    throw new Error("Only pending event requests can be declined.")
  }

  const nowIso = new Date().toISOString()

  const { error } = await supabase
    .from("internal_events")
    .update({
      status: INTERNAL_EVENT_STATUSES.declined,
      declined_at: nowIso,
      decline_reason: input.declineReason?.trim() || null,
    })
    .eq("id", input.eventId)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error("Failed to decline event request")
  }

  await syncOperationalBriefForInternalEvent(input.eventId, organizationId)

  fireModuleNotifications([
    {
      organizationId,
      moduleKey: "event_management",
      audience: "staff",
      eventKey: "request_declined",
      subject: "Internal event declined",
      summary: "An internal event request was declined.",
      metadata: { eventId: input.eventId, reason: input.declineReason },
    },
    {
      organizationId,
      moduleKey: "event_management",
      audience: "customer",
      eventKey: "request_declined",
      subject: "Event request declined",
      summary: "Your internal event request was declined.",
      metadata: { eventId: input.eventId, reason: input.declineReason },
    },
  ])

  revalidateInternalEventPaths(input.eventId)
}

export async function updateInternalEvent(input: UpdateInternalEventInput) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const canManage = await hasAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  const existingEvent = await getInternalEventRecordById(input.id)
  if (!existingEvent) {
    throw new Error("Event not found.")
  }

  const isPendingOwner =
    Boolean(user?.id) &&
    existingEvent.created_by === user?.id &&
    existingEvent.status === INTERNAL_EVENT_STATUSES.awaitingApproval

  if (!canManage && !isPendingOwner) {
    throw new Error("You do not have permission to update events.")
  }

  const payload = validateEventInput(input)

  const modulesProvided =
    input.requires_volunteers !== undefined ||
    input.requires_childcare !== undefined ||
    input.requires_vendors !== undefined ||
    input.requires_ticketing !== undefined ||
    input.service_requirements !== undefined ||
    input.ticketing_config !== undefined ||
    input.ticketTypes !== undefined

  if (!modulesProvided) {
    payload.requires_volunteers = existingEvent.requires_volunteers === true
    payload.requires_childcare = existingEvent.requires_childcare === true
    payload.requires_vendors = existingEvent.requires_vendors === true
    payload.requires_ticketing = existingEvent.requires_ticketing === true
    payload.service_requirements =
      (existingEvent.service_requirements as EventServiceRequirements) || {}
    payload.ticketing_config =
      (existingEvent.ticketing_config as EventTicketingConfig) || {}
  } else {
    validateTicketingInput(input)
  }

  if (!payload.location_type) {
    throw new Error("Select where this event takes place.")
  }

  const { venue_ids: venueIds, recurrence_config: _recurrence, ...eventPayload } = payload

  await assertDepartmentInOrg(supabase, organizationId, eventPayload.department_id)
  await assertEventTypeInOrg(supabase, organizationId, eventPayload.event_type_id)
  if (
    eventPayload.location_type === INTERNAL_EVENT_LOCATION_TYPES.facility &&
    venueIds.length > 0
  ) {
    await assertVenuesInOrg(supabase, organizationId, venueIds)
  }

  eventPayload.ticketing_config = {
    ...((existingEvent.ticketing_config as Record<string, unknown>) || {}),
    ...(eventPayload.ticketing_config as Record<string, unknown>),
  }

  // Keep existing recurrence series metadata; occurrence edits don't rebuild the series.
  delete (eventPayload as { recurrence_config?: unknown }).recurrence_config

  // Pending owner edits keep awaiting approval; managers keep existing status unless changed via status tools.
  if (!canManage && isPendingOwner) {
    eventPayload.status = INTERNAL_EVENT_STATUSES.awaitingApproval
  } else {
    // Preserve status on field edits from the facility drawer.
    eventPayload.status = existingEvent.status
  }

  const { error } = await supabase
    .from("internal_events")
    .update(eventPayload)
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error("Failed to update event")
  }

  await replaceInternalEventVenues({
    supabase,
    organizationId,
    eventId: input.id,
    venueIds,
  })

  await syncOperationalBriefForInternalEvent(input.id, organizationId, {
    operationalSetup:
      eventPayload.location_type === INTERNAL_EVENT_LOCATION_TYPES.facility
        ? input.operationalSetup
        : emptyFacilityOperationalSetup(),
  })

  if (modulesProvided) {
    await syncTicketingForEvent(input.id, input)
  }

  fireModuleNotifications([
    {
      organizationId,
      moduleKey: "event_management",
      audience: "staff",
      eventKey: "event_updated",
      subject: "Internal event updated",
      summary: "An internal event was updated.",
      metadata: { eventId: input.id },
    },
    {
      organizationId,
      moduleKey: "event_management",
      audience: "customer",
      eventKey: "event_updated",
      subject: "Event updated",
      summary: "Your internal event details were updated.",
      metadata: { eventId: input.id },
    },
  ])

  revalidateInternalEventPaths(input.id)
  revalidatePath(`/event-management/${input.id}`)
}

export async function updateInternalEventStatus(
  id: string,
  status: InternalEventStatus
) {
  const canManage = await hasAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )
  if (!canManage) {
    throw new Error("You do not have permission to update events.")
  }

  if (!Object.values(INTERNAL_EVENT_STATUSES).includes(status)) {
    throw new Error("Invalid event status.")
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("internal_events")
    .update({ status })
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error("Failed to update event status")
  }

  await syncOperationalBriefForInternalEvent(id, organizationId)

  if (status === INTERNAL_EVENT_STATUSES.cancelled) {
    fireModuleNotifications([
      {
        organizationId,
        moduleKey: "event_management",
        audience: "staff",
        eventKey: "event_cancelled",
        subject: "Internal event cancelled",
        summary: "An internal event was cancelled.",
        metadata: { eventId: id },
      },
      {
        organizationId,
        moduleKey: "event_management",
        audience: "customer",
        eventKey: "event_cancelled",
        subject: "Event cancelled",
        summary: "Your internal event was cancelled.",
        metadata: { eventId: id },
      },
    ])
  }

  revalidateInternalEventPaths(id)
  revalidatePath(`/event-management/${id}`)
}

export async function deleteInternalEvent(
  id: string
): Promise<InternalEventCatalogActionResult> {
  const canManage = await hasAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )
  if (!canManage) {
    return { success: false, error: "You do not have permission to delete events." }
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const blockers = await getInternalEventDeleteBlockers(id, organizationId)
  if (blockers) {
    return { success: false, error: blockers }
  }

  const { error } = await supabase
    .from("internal_events")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    return { success: false, error: error.message || "Failed to delete event." }
  }

  revalidateInternalEventPaths()
  revalidateTicketingPaths()

  return { success: true }
}

/**
 * Returns a human-readable reason when an event must not be deleted, else null.
 * Blocks on any ticket orders / tickets (financial activity) or any registrations
 * (volunteer, vendor, childcare provider, or childcare child sign-ups).
 */
export async function getInternalEventDeleteBlockers(
  eventId: string,
  organizationId?: string | null
): Promise<string | null> {
  const orgId = organizationId ?? (await getSelectedOrganizationId())
  if (!orgId || !eventId) return null

  const supabase = await createClient()

  const [ordersResult, ticketsResult, participationsResult, childcareEventResult] =
    await Promise.all([
      supabase
        .from("ticket_orders")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("internal_event_id", eventId),
      supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("internal_event_id", eventId),
      supabase
        .from("service_participations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("source_type", "internal_event")
        .eq("source_id", eventId),
      supabase
        .from("childcare_events")
        .select("id")
        .eq("organization_id", orgId)
        .eq("source_type", "internal_event")
        .eq("source_id", eventId)
        .maybeSingle(),
    ])

  const reasons: string[] = []

  if (!ordersResult.error && (ordersResult.count || 0) > 0) {
    reasons.push("ticket orders or payments")
  } else if (!ticketsResult.error && (ticketsResult.count || 0) > 0) {
    reasons.push("ticket registrations")
  }

  if (
    !participationsResult.error &&
    (participationsResult.count || 0) > 0
  ) {
    reasons.push("volunteer, childcare provider, or vendor registrations")
  }

  if (!childcareEventResult.error && childcareEventResult.data?.id) {
    const { count, error } = await supabase
      .from("childcare_registrations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("childcare_event_id", childcareEventResult.data.id as string)

    if (!error && (count || 0) > 0) {
      reasons.push("youth / childcare registrations")
    }
  }

  if (reasons.length === 0) return null

  if (reasons.length === 1) {
    return `This event has ${reasons[0]} and can't be deleted.`
  }

  const last = reasons[reasons.length - 1]
  const head = reasons.slice(0, -1).join(", ")
  return `This event has ${head}, and ${last}, and can't be deleted.`
}

export async function getInternalEventDeleteBlockersMap(
  eventIds: string[]
): Promise<Record<string, string | null>> {
  const uniqueIds = Array.from(new Set(eventIds.filter(Boolean)))
  const result: Record<string, string | null> = {}

  if (uniqueIds.length === 0) {
    return result
  }

  await Promise.all(
    uniqueIds.map(async (eventId) => {
      result[eventId] = await getInternalEventDeleteBlockers(eventId)
    })
  )

  return result
}

export async function duplicateInternalEvent(
  sourceEventId: string
): Promise<InternalEventCatalogActionResult> {
  const canManage = await hasAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )
  if (!canManage) {
    return { success: false, error: "You do not have permission to copy events." }
  }

  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const source = await getInternalEventRecordById(sourceEventId)

  if (!source) {
    return { success: false, error: "Event not found." }
  }

  try {
    const inferredLocationType = isInternalEventLocationType(source.location_type)
      ? source.location_type
      : source.venue_id
        ? INTERNAL_EVENT_LOCATION_TYPES.facility
        : INTERNAL_EVENT_LOCATION_TYPES.online

    const sourceVenueIds =
      inferredLocationType === INTERNAL_EVENT_LOCATION_TYPES.facility
        ? await getInternalEventVenueIds(sourceEventId)
        : []
    const facilityVenueIds =
      sourceVenueIds.length > 0
        ? sourceVenueIds
        : source.venue_id
          ? [source.venue_id]
          : []

    const eventId = await createInternalEvent({
      name: buildCopyName(source.name),
      department_id: source.department_id,
      event_type_id: source.event_type_id,
      description: source.description,
      status: INTERNAL_EVENT_STATUSES.draft,
      start_at: null,
      end_at: null,
      venue_id: facilityVenueIds[0] || null,
      venue_ids: facilityVenueIds,
      location_type: inferredLocationType,
      location_label:
        inferredLocationType === INTERNAL_EVENT_LOCATION_TYPES.external
          ? source.location_label
          : inferredLocationType === INTERNAL_EVENT_LOCATION_TYPES.online
            ? "Online"
            : source.location_label,
      location_address:
        inferredLocationType === INTERNAL_EVENT_LOCATION_TYPES.external
          ? source.location_address
          : null,
      timezone: source.timezone,
      requires_volunteers: source.requires_volunteers === true,
      requires_childcare: source.requires_childcare === true,
      requires_vendors: source.requires_vendors === true,
      service_requirements: source.service_requirements || {},
    })

    return { success: true, eventId }
  } catch (error) {
    console.error(error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to copy event.",
    }
  }
}

export async function updateInternalEventModules(input: {
  eventId: string
  serviceForm?: EventServiceRequirementsFormState
  ticketingForm?: EventTicketingFormState
  checkoutConfig?: EventTicketingConfig["checkout"] | null
  communicationsConfig?: EventTicketingConfig["communications"] | null
  /** Writes ticketing_config.attendanceMode; sets requires_ticketing = mode !== open_public. */
  attendanceMode?: EventAttendanceMode
}): Promise<InternalEventCatalogActionResult> {
  try {
    const canManage = await hasAnyPermission(
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE
    )
    if (!canManage) {
      return { success: false, error: "You do not have permission to update events." }
    }

    const supabase = await createClient()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected" }
    }

    const existingEvent = await getInternalEventRecordById(input.eventId)
    if (!existingEvent) {
      return { success: false, error: "Event not found." }
    }

    const updatePayload: Record<string, unknown> = {}
    let ticketSyncInput: CreateInternalEventInput | null = null
    const existingConfig =
      ((existingEvent.ticketing_config as Record<string, unknown>) || {})

    if (input.serviceForm) {
      const servicePayload = buildServiceRequirementsPayload(input.serviceForm)
      updatePayload.requires_volunteers = servicePayload.requires_volunteers
      updatePayload.requires_childcare = servicePayload.requires_childcare
      updatePayload.requires_vendors = servicePayload.requires_vendors
      updatePayload.service_requirements = servicePayload.service_requirements

      const currentFeatures = resolveEventWorkspaceFeatures(existingEvent)
      updatePayload.workspace_features = {
        ...currentFeatures,
        youth: currentFeatures.youth || servicePayload.requires_childcare,
        vendors: currentFeatures.vendors || servicePayload.requires_vendors,
      }
    }

    if (input.ticketingForm) {
      const ticketingPayload = buildTicketingPayload(input.ticketingForm)
      if (ticketingPayload.requires_ticketing) {
        validateTicketingInput({
          name: existingEvent.name,
          department_id: existingEvent.department_id,
          event_type_id: existingEvent.event_type_id,
          requires_ticketing: true,
          ticketTypes: ticketingPayload.ticketTypes,
        })
      }
      updatePayload.requires_ticketing = ticketingPayload.requires_ticketing
      updatePayload.ticketing_config = {
        ...existingConfig,
        ...(ticketingPayload.ticketing_config as Record<string, unknown>),
      }
      ticketSyncInput = {
        name: existingEvent.name,
        department_id: existingEvent.department_id,
        event_type_id: existingEvent.event_type_id,
        requires_ticketing: ticketingPayload.requires_ticketing,
        ticketTypes: ticketingPayload.ticketTypes,
        ticketing_config: ticketingPayload.ticketing_config,
      }
    }

    if (input.checkoutConfig !== undefined) {
      const baseConfig =
        (updatePayload.ticketing_config as Record<string, unknown> | undefined) ||
        existingConfig
      updatePayload.ticketing_config = {
        ...baseConfig,
        checkout: input.checkoutConfig,
      }
    }

    if (input.communicationsConfig !== undefined) {
      const baseConfig =
        (updatePayload.ticketing_config as Record<string, unknown> | undefined) ||
        existingConfig
      updatePayload.ticketing_config = {
        ...baseConfig,
        communications: input.communicationsConfig,
      }
    }

    if (input.attendanceMode !== undefined) {
      const mode = parseAttendanceMode(input.attendanceMode)
      if (!mode) {
        return { success: false, error: "Invalid attendance mode." }
      }
      const requiresTicketing = mode !== "open_public"
      const baseConfig =
        (updatePayload.ticketing_config as Record<string, unknown> | undefined) ||
        existingConfig
      updatePayload.ticketing_config = {
        ...baseConfig,
        attendanceMode: mode,
      }
      updatePayload.requires_ticketing = requiresTicketing
      if (ticketSyncInput) {
        ticketSyncInput = {
          ...ticketSyncInput,
          requires_ticketing: requiresTicketing,
          ticketing_config: {
            ...(ticketSyncInput.ticketing_config || {}),
            attendanceMode: mode,
          },
        }
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return { success: false, error: "Nothing to update." }
    }

    const { error } = await supabase
      .from("internal_events")
      .update(updatePayload)
      .eq("id", input.eventId)
      .eq("organization_id", organizationId)

    if (error) {
      console.error(error)
      return { success: false, error: "Failed to update event modules." }
    }

    if (ticketSyncInput) {
      await syncTicketingForEvent(input.eventId, ticketSyncInput)
    }

    revalidateInternalEventPaths(input.eventId)
    revalidatePath(`/event-management/${input.eventId}`)
    if (input.serviceForm) {
      revalidatePath("/customer/opportunities")
    }
    return { success: true, eventId: input.eventId }
  } catch (error) {
    console.error(error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update event modules.",
    }
  }
}

export async function updateEventWorkspaceFeatures(input: {
  eventId: string
  features: EventWorkspaceFeatures
}): Promise<InternalEventCatalogActionResult> {
  try {
    const canManage = await hasAnyPermission(
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE
    )
    if (!canManage) {
      return { success: false, error: "You do not have permission to update events." }
    }

    const supabase = await createClient()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected" }
    }

    const existingEvent = await getInternalEventRecordById(input.eventId)
    if (!existingEvent) {
      return { success: false, error: "Event not found." }
    }

    const parsed = parseEventWorkspaceFeatures(input.features)
    const features: EventWorkspaceFeatures = {
      registration: parsed.registration ?? false,
      staff: parsed.staff ?? false,
      youth: parsed.youth ?? false,
      vendors: parsed.vendors ?? false,
      finance: parsed.finance ?? false,
      waitlist: parsed.waitlist ?? false,
    }

    const { error } = await supabase
      .from("internal_events")
      .update({
        workspace_features: features,
        // Keep legacy module flags in sync for Youth/Vendors eligibility.
        // Do NOT map staff → requires_volunteers (that flag means open volunteer sign-ups).
        requires_childcare: features.youth,
        requires_vendors: features.vendors,
        requires_ticketing:
          features.registration &&
          resolveAttendanceMode({
            requires_ticketing: existingEvent.requires_ticketing,
            ticketing_config: existingEvent.ticketing_config as {
              attendanceMode?: unknown
            } | null,
          }) !== "open_public",
      })
      .eq("id", input.eventId)
      .eq("organization_id", organizationId)

    if (error) {
      console.error(error)
      const message = error.message || ""
      if (message.includes("workspace_features") || message.includes("schema cache")) {
        return {
          success: false,
          error:
            "Workspace features column is missing. Run scripts/252_event_workspace_redesign.sql in Supabase, then try again.",
        }
      }
      return { success: false, error: "Failed to update workspace features." }
    }

    revalidateInternalEventPaths(input.eventId)
    revalidatePath(`/event-management/${input.eventId}`)
    return { success: true, eventId: input.eventId }
  } catch (error) {
    console.error(error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update workspace features.",
    }
  }
}

function isMissingEventMetaColumnError(message: string) {
  return (
    message.includes("coordinator_contact_id") ||
    message.includes("audience") ||
    message.includes("event_tags") ||
    message.includes("estimated_attendance") ||
    message.includes("internal_notes") ||
    message.includes("schema cache")
  )
}

export async function updateEventWorkspaceMeta(input: {
  eventId: string
  coordinatorContactId?: string | null
  audience?: string[]
  eventTags?: string[]
  estimatedAttendance?: number | null
  internalNotes?: string | null
}): Promise<InternalEventCatalogActionResult> {
  try {
    const canManage = await hasAnyPermission(
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE
    )
    if (!canManage) {
      return { success: false, error: "You do not have permission to update events." }
    }

    const supabase = await createClient()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected" }
    }

    const existingEvent = await getInternalEventRecordById(input.eventId)
    if (!existingEvent) {
      return { success: false, error: "Event not found." }
    }

    const audience = Array.isArray(input.audience)
      ? input.audience
          .map((value) => value.trim())
          .filter(Boolean)
      : []
    const eventTags = Array.isArray(input.eventTags)
      ? input.eventTags
          .map((value) => value.trim())
          .filter(Boolean)
      : []

    let estimatedAttendance: number | null = null
    if (input.estimatedAttendance != null) {
      if (
        !Number.isFinite(input.estimatedAttendance) ||
        input.estimatedAttendance < 0
      ) {
        return {
          success: false,
          error: "Estimated attendance must be a non-negative number.",
        }
      }
      estimatedAttendance = Math.floor(input.estimatedAttendance)
    }

    const coordinatorContactId =
      typeof input.coordinatorContactId === "string" &&
      input.coordinatorContactId.trim()
        ? input.coordinatorContactId.trim()
        : null

    const { error } = await supabase
      .from("internal_events")
      .update({
        coordinator_contact_id: coordinatorContactId,
        audience,
        event_tags: eventTags,
        estimated_attendance: estimatedAttendance,
        internal_notes:
          typeof input.internalNotes === "string"
            ? input.internalNotes.trim() || null
            : null,
      })
      .eq("id", input.eventId)
      .eq("organization_id", organizationId)

    if (error) {
      console.error(error)
      const message = error.message || ""
      if (isMissingEventMetaColumnError(message)) {
        return {
          success: false,
          error:
            "Event metadata columns are missing. Run scripts/252_event_workspace_redesign.sql in Supabase, then try again.",
        }
      }
      return { success: false, error: "Failed to update event metadata." }
    }

    revalidateInternalEventPaths(input.eventId)
    revalidatePath(`/event-management/${input.eventId}`)
    return { success: true, eventId: input.eventId }
  } catch (error) {
    console.error(error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update event metadata.",
    }
  }
}

export async function updateEventLinkedCampaign(input: {
  eventId: string
  linkedCampaignId: string | null
}): Promise<InternalEventCatalogActionResult> {
  try {
    const canManage = await hasAnyPermission(
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE
    )
    if (!canManage) {
      return { success: false, error: "You do not have permission to update events." }
    }

    const supabase = await createClient()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected" }
    }

    const existingEvent = await getInternalEventRecordById(input.eventId)
    if (!existingEvent) {
      return { success: false, error: "Event not found." }
    }

    const linkedCampaignId =
      typeof input.linkedCampaignId === "string" && input.linkedCampaignId.trim()
        ? input.linkedCampaignId.trim()
        : null

    if (linkedCampaignId) {
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("id", linkedCampaignId)
        .maybeSingle()

      if (campaignError || !campaign) {
        return { success: false, error: "Campaign not found." }
      }
    }

    const ticketingConfig =
      (existingEvent.ticketing_config as Record<string, unknown>) || {}

    const { error } = await supabase
      .from("internal_events")
      .update({
        ticketing_config: {
          ...ticketingConfig,
          linkedCampaignId,
        },
      })
      .eq("id", input.eventId)
      .eq("organization_id", organizationId)

    if (error) {
      return { success: false, error: error.message || "Failed to link campaign." }
    }

    revalidateInternalEventPaths(input.eventId)
    revalidatePath(`/event-management/${input.eventId}`)
    return { success: true, eventId: input.eventId }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to link campaign.",
    }
  }
}

export async function updateInternalEventFlyer(input: {
  eventId: string
  flyerUrl: string | null
}): Promise<InternalEventCatalogActionResult> {
  try {
    const canManage = await hasAnyPermission(
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE
    )
    if (!canManage) {
      return { success: false, error: "You do not have permission to update events." }
    }

    const supabase = await createClient()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected" }
    }

    const { error } = await supabase
      .from("internal_events")
      .update({
        flyer_url: input.flyerUrl?.trim() || null,
      })
      .eq("id", input.eventId)
      .eq("organization_id", organizationId)

    if (error) {
      console.error(error)
      const message = error.message || ""
      if (message.includes("flyer_url") || message.includes("schema cache")) {
        return {
          success: false,
          error:
            "Flyer column is missing. Run scripts/214_internal_event_flyer_url.sql in Supabase, then try again.",
        }
      }
      return { success: false, error: "Failed to update event flyer." }
    }

    revalidateInternalEventPaths(input.eventId)
    revalidatePath(`/event-management/${input.eventId}`)
    return { success: true, eventId: input.eventId }
  } catch (error) {
    console.error(error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update event flyer.",
    }
  }
}

export async function updateInternalEventCommunityCalendar(input: {
  eventId: string
  visibility: CommunityCalendarVisibility
}): Promise<InternalEventCatalogActionResult> {
  try {
    const canManage = await hasAnyPermission(
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE
    )
    if (!canManage) {
      return { success: false, error: "You do not have permission to update events." }
    }

    const supabase = await createClient()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected" }
    }

    const status = calendarStatusFromVisibility(input.visibility)
    const { error } = await supabase
      .from("internal_events")
      .update({
        community_calendar_status: status,
      })
      .eq("id", input.eventId)
      .eq("organization_id", organizationId)

    if (error) {
      console.error(error)
      const message = error.message || ""
      if (
        message.includes("community_calendar_status") ||
        message.includes("schema cache")
      ) {
        return {
          success: false,
          error:
            "Community calendar column is missing. Run scripts/247_internal_event_community_calendar.sql in Supabase, then try again.",
        }
      }
      return { success: false, error: "Failed to update community calendar visibility." }
    }

    revalidateInternalEventPaths(input.eventId)
    revalidatePath(`/event-management/${input.eventId}`)
    revalidatePath(COMMUNITY_CALENDAR_PATH)
    return { success: true, eventId: input.eventId }
  } catch (error) {
    console.error(error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update community calendar visibility.",
    }
  }
}

export async function updateInternalEventDescription(input: {
  eventId: string
  description: string | null
}): Promise<InternalEventCatalogActionResult> {
  try {
    const canManage = await hasAnyPermission(
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE
    )
    if (!canManage) {
      return { success: false, error: "You do not have permission to update events." }
    }

    const supabase = await createClient()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected" }
    }

    const { error } = await supabase
      .from("internal_events")
      .update({
        description: input.description?.trim() || null,
      })
      .eq("id", input.eventId)
      .eq("organization_id", organizationId)

    if (error) {
      console.error(error)
      return { success: false, error: "Failed to update event description." }
    }

    revalidateInternalEventPaths(input.eventId)
    revalidatePath(`/event-management/${input.eventId}`)
    return { success: true, eventId: input.eventId }
  } catch (error) {
    console.error(error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update event description.",
    }
  }
}

function clampFocalPercent(value: number) {
  if (!Number.isFinite(value)) return 50
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10))
}

export async function updateInternalEventFlyerFocal(input: {
  eventId: string
  focalX: number
  focalY: number
}): Promise<InternalEventCatalogActionResult> {
  try {
    const canManage = await hasAnyPermission(
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE
    )
    if (!canManage) {
      return { success: false, error: "You do not have permission to update events." }
    }

    const supabase = await createClient()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected" }
    }

    const focalX = clampFocalPercent(input.focalX)
    const focalY = clampFocalPercent(input.focalY)

    const { error } = await supabase
      .from("internal_events")
      .update({
        flyer_focal_x: focalX,
        flyer_focal_y: focalY,
      })
      .eq("id", input.eventId)
      .eq("organization_id", organizationId)

    if (error) {
      console.error(error)
      const message = error.message || ""
      if (
        message.includes("flyer_focal") ||
        message.includes("schema cache")
      ) {
        return {
          success: false,
          error:
            "Flyer crop columns are missing. Run scripts/249_internal_event_flyer_focal.sql in Supabase, then try again.",
        }
      }
      return { success: false, error: "Failed to update flyer crop." }
    }

    revalidateInternalEventPaths(input.eventId)
    revalidatePath(`/event-management/${input.eventId}`)
    revalidatePath(COMMUNITY_CALENDAR_PATH)
    return { success: true, eventId: input.eventId }
  } catch (error) {
    console.error(error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update flyer crop.",
    }
  }
}

"use server"

import { revalidatePath } from "next/cache"

import { syncOperationalBriefForInternalEvent } from "@/lib/operational-briefs/operational-brief-queries"
import type { OperationalSetupInput } from "@/lib/operational-briefs/operational-setup-input"
import type { EventServiceRequirements } from "./event-service-requirements"
import type { EventTicketTypeInput } from "@/lib/tickets/ticket-types"
import { syncEventTicketTypes } from "@/lib/tickets/ticket-type-actions"
import type { EventTicketingConfig } from "@/lib/tickets/ticket-types"
import { revalidateTicketingPaths } from "@/lib/tickets/revalidate-ticketing-paths"
import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { userCanSubmitInternalEventRequest } from "@/lib/auth/staff-tools-eligibility"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { getConflictingReservations } from "@/lib/reservations/reservation-queries"
import { fireModuleNotifications } from "@/lib/notifications/dispatch-module-notification"

import { buildCopyName } from "@/lib/programs/program-fee-plan-copy-utils"

import type { InternalEventStatus } from "./internal-event-status"
import { INTERNAL_EVENT_STATUSES } from "./internal-event-status"
import { getInternalEventRecordById } from "./internal-event-queries"

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
  location_label?: string | null
  timezone?: string | null
  requires_volunteers?: boolean
  requires_childcare?: boolean
  requires_vendors?: boolean
  requires_ticketing?: boolean
  service_requirements?: EventServiceRequirements
  ticketing_config?: EventTicketingConfig
  ticketTypes?: EventTicketTypeInput[]
  operationalSetup?: OperationalSetupInput
}

type UpdateInternalEventInput = CreateInternalEventInput & {
  id: string
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

  return {
    name,
    department_id: input.department_id,
    event_type_id: input.event_type_id,
    description: input.description?.trim() || null,
    status,
    start_at: startAt,
    end_at: endAt,
    venue_id: input.venue_id || null,
    location_label: input.location_label?.trim() || null,
    timezone: input.timezone?.trim() || null,
    requires_volunteers: input.requires_volunteers === true,
    requires_childcare: input.requires_childcare === true,
    requires_vendors: input.requires_vendors === true,
    requires_ticketing: input.requires_ticketing === true,
    service_requirements: input.service_requirements || {},
    ticketing_config: input.ticketing_config || {},
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

async function assertInternalEventSpaceAvailable(input: {
  organizationId: string
  venueId: string
  startAt: string
  endAt: string
  excludeEventId?: string
}) {
  let excludeReservationId: string | undefined

  if (input.excludeEventId) {
    const supabase = await createClient()
    const { data } = await supabase
      .from("resource_reservations")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("source_type", "internal_event")
      .eq("source_id", input.excludeEventId)
      .maybeSingle()

    excludeReservationId = data?.id as string | undefined
  }

  const conflicts = await getConflictingReservations(
    input.organizationId,
    input.venueId,
    null,
    input.startAt,
    input.endAt,
    excludeReservationId
  )

  if (conflicts.length > 0) {
    throw new Error(
      `Space is unavailable for the selected time (${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"}).`
    )
  }
}

function revalidateInternalEventPaths(eventId?: string) {
  revalidatePath("/event-management")
  revalidatePath("/event-management/calendar")
  revalidatePath("/facilities/availability")
  revalidatePath("/event-management/overview")
  revalidatePath("/event-management/overview")
  revalidatePath("/facilities/calendar")
  revalidatePath("/facilities/reservation-center")
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

  await assertDepartmentInOrg(supabase, organizationId, payload.department_id)
  await assertEventTypeInOrg(supabase, organizationId, payload.event_type_id)
  await assertVenueInOrg(supabase, organizationId, payload.venue_id)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from("internal_events")
    .insert({
      organization_id: organizationId,
      ...payload,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single()

  if (error) {
    console.error(error)
    throw new Error("Failed to create event")
  }

  await syncOperationalBriefForInternalEvent(data.id as string, organizationId, {
    operationalSetup: input.operationalSetup,
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

  const payload = validateEventInput({
    ...input,
    status: INTERNAL_EVENT_STATUSES.awaitingApproval,
  })
  validateTicketingInput(input)

  if (!payload.venue_id) {
    throw new Error("A venue is required to submit an event request.")
  }

  if (!payload.start_at || !payload.end_at) {
    throw new Error("Start and end times are required to submit an event request.")
  }

  await assertDepartmentInOrg(supabase, organizationId, payload.department_id)
  await assertEventTypeInOrg(supabase, organizationId, payload.event_type_id)
  await assertVenueInOrg(supabase, organizationId, payload.venue_id)
  await assertInternalEventSpaceAvailable({
    organizationId,
    venueId: payload.venue_id,
    startAt: payload.start_at,
    endAt: payload.end_at,
  })

  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from("internal_events")
    .insert({
      organization_id: organizationId,
      ...payload,
      status: INTERNAL_EVENT_STATUSES.awaitingApproval,
      submitted_at: nowIso,
      created_by: user.id,
    })
    .select("id")
    .single()

  if (error) {
    console.error(error)
    throw new Error("Failed to submit event request")
  }

  await syncOperationalBriefForInternalEvent(data.id as string, organizationId, {
    operationalSetup: input.operationalSetup,
  })

  await syncTicketingForEvent(data.id as string, input)

  fireModuleNotifications([
    {
      organizationId,
      moduleKey: "event_management",
      audience: "staff",
      eventKey: "request_submitted",
      subject: "New internal event request",
      summary: "A staff member submitted a new internal event request.",
      metadata: { eventId: data.id, submittedBy: user.id },
    },
    {
      organizationId,
      moduleKey: "event_management",
      audience: "customer",
      eventKey: "request_received",
      subject: "Event request received",
      summary: "Your internal event request was received and is awaiting review.",
      metadata: { eventId: data.id, submittedBy: user.id },
    },
  ])

  revalidateInternalEventPaths(data.id as string)

  return data.id as string
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

  if (event.venue_id && event.start_at && event.end_at) {
    await assertInternalEventSpaceAvailable({
      organizationId,
      venueId: event.venue_id,
      startAt: event.start_at,
      endAt: event.end_at,
      excludeEventId: eventId,
    })
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
  const canManage = await hasAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )
  if (!canManage) {
    throw new Error("You do not have permission to update events.")
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const payload = validateEventInput(input)
  validateTicketingInput(input)

  await assertDepartmentInOrg(supabase, organizationId, payload.department_id)
  await assertEventTypeInOrg(supabase, organizationId, payload.event_type_id)
  await assertVenueInOrg(supabase, organizationId, payload.venue_id)

  const existingEvent = await getInternalEventRecordById(input.id)
  if (existingEvent) {
    payload.ticketing_config = {
      ...((existingEvent.ticketing_config as Record<string, unknown>) || {}),
      ...(payload.ticketing_config as Record<string, unknown>),
    }
  }

  const { error } = await supabase
    .from("internal_events")
    .update(payload)
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error("Failed to update event")
  }

  await syncOperationalBriefForInternalEvent(input.id, organizationId, {
    operationalSetup: input.operationalSetup,
  })

  await syncTicketingForEvent(input.id, input)

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

  return { success: true }
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
    const eventId = await createInternalEvent({
      name: buildCopyName(source.name),
      department_id: source.department_id,
      event_type_id: source.event_type_id,
      description: source.description,
      status: INTERNAL_EVENT_STATUSES.draft,
      start_at: null,
      end_at: null,
      venue_id: source.venue_id,
      location_label: source.location_label,
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

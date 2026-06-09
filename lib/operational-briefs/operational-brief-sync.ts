import type { SupabaseClient } from "@supabase/supabase-js"

import {
  OPERATIONAL_BRIEF_SETUP_STATUSES,
  OPERATIONAL_BRIEF_SOURCE_TYPES,
  type OperationalBriefUpsertInput,
} from "./operational-brief-types"

function toDateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null
  return iso.slice(0, 10)
}

function toTimeOnly(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(11, 19)
}

export function mapInternalEventRowToBriefInput(input: {
  organizationId: string
  event: {
    id: string
    name: string
    description: string | null
    status: string
    start_at: string | null
    end_at: string | null
    venue_id: string | null
    location_label: string | null
    created_by: string | null
  }
  venueName?: string | null
  reservationId?: string | null
  createdBy?: string | null
  internalCoordinator?: {
    contactId?: string | null
    fullName?: string | null
    phone?: string | null
    email?: string | null
  } | null
}): OperationalBriefUpsertInput {
  const spaces = [input.venueName, input.event.location_label]
    .filter(Boolean)
    .join(", ")

  return {
    organization_id: input.organizationId,
    source_type: OPERATIONAL_BRIEF_SOURCE_TYPES.internalEvent,
    source_id: input.event.id,
    reservation_id: input.reservationId ?? null,
    title: input.event.name,
    event_date: toDateOnly(input.event.start_at),
    start_time: toTimeOnly(input.event.start_at),
    end_time: toTimeOnly(input.event.end_at),
    special_requests: input.event.description,
    facility_notes: spaces ? `Spaces: ${spaces}` : null,
    internal_coordinator_person_id: input.internalCoordinator?.contactId ?? null,
    internal_coordinator_name: input.internalCoordinator?.fullName ?? null,
    internal_coordinator_phone: input.internalCoordinator?.phone ?? null,
    internal_coordinator_email: input.internalCoordinator?.email ?? null,
    source_status: input.event.status,
    setup_status:
      input.event.status === "confirmed" ||
      input.event.status === "approved" ||
      input.event.status === "scheduled"
        ? OPERATIONAL_BRIEF_SETUP_STATUSES.readyForSetup
        : input.event.status === "awaiting_approval" ||
            input.event.status === "submitted"
          ? OPERATIONAL_BRIEF_SETUP_STATUSES.needsReview
          : input.event.status === "declined" ||
              input.event.status === "cancelled"
            ? OPERATIONAL_BRIEF_SETUP_STATUSES.closed
            : OPERATIONAL_BRIEF_SETUP_STATUSES.notStarted,
    created_by: input.createdBy ?? input.event.created_by,
    updated_by: input.createdBy ?? input.event.created_by,
  }
}

export function mapVenueRentalRowToBriefInput(input: {
  organizationId: string
  rental: {
    id: string
    status: string
    notes: string | null
    customer_user_id: string | null
    created_by: string | null
  }
  eventTypeName?: string | null
  spaces: Array<{ venueName: string; start_at: string; end_at: string }>
  customerContact?: {
    contactId?: string | null
    fullName?: string | null
    phone?: string | null
    email?: string | null
  } | null
  internalCoordinator?: {
    contactId?: string | null
    fullName?: string | null
    phone?: string | null
    email?: string | null
  } | null
  reservationId?: string | null
  updatedBy?: string | null
}): OperationalBriefUpsertInput {
  const sortedSpaces = [...input.spaces].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  )
  const primary = sortedSpaces[0]
  const spaceNames = sortedSpaces.map((space) => space.venueName).join(", ")

  return {
    organization_id: input.organizationId,
    source_type: OPERATIONAL_BRIEF_SOURCE_TYPES.venueRental,
    source_id: input.rental.id,
    reservation_id: input.reservationId ?? null,
    title: input.eventTypeName
      ? `${input.eventTypeName} — Venue Rental`
      : "Venue Rental Request",
    event_date: primary ? toDateOnly(primary.start_at) : null,
    start_time: primary ? toTimeOnly(primary.start_at) : null,
    end_time: primary ? toTimeOnly(primary.end_at) : null,
    primary_contact_person_id: input.customerContact?.contactId ?? null,
    primary_contact_name: input.customerContact?.fullName ?? null,
    primary_contact_phone: input.customerContact?.phone ?? null,
    special_requests: input.rental.notes,
    facility_notes: spaceNames ? `Spaces: ${spaceNames}` : null,
    source_status: input.rental.status,
    setup_status:
      input.rental.status === "confirmed"
        ? OPERATIONAL_BRIEF_SETUP_STATUSES.readyForSetup
        : OPERATIONAL_BRIEF_SETUP_STATUSES.needsReview,
    created_by: input.rental.created_by,
    updated_by: input.updatedBy ?? input.rental.created_by,
  }
}

export function mapMaintenanceReservationToBriefInput(input: {
  organizationId: string
  reservation: {
    id: string
    title: string
    description: string | null
    start_at: string
    end_at: string
    source_type: string
    status: string
    venue_id: string | null
    space_label: string | null
  }
  venueName?: string | null
  createdBy?: string | null
}): OperationalBriefUpsertInput {
  const spaces = [input.venueName, input.reservation.space_label]
    .filter(Boolean)
    .join(", ")

  return {
    organization_id: input.organizationId,
    source_type: OPERATIONAL_BRIEF_SOURCE_TYPES.maintenance,
    source_id: null,
    reservation_id: input.reservation.id,
    title: input.reservation.title,
    event_date: toDateOnly(input.reservation.start_at),
    start_time: toTimeOnly(input.reservation.start_at),
    end_time: toTimeOnly(input.reservation.end_at),
    facility_notes: spaces ? `Spaces: ${spaces}` : null,
    special_requests: input.reservation.description,
    source_status: input.reservation.status,
    setup_status: OPERATIONAL_BRIEF_SETUP_STATUSES.readyForSetup,
    created_by: input.createdBy ?? null,
    updated_by: input.createdBy ?? null,
  }
}

export function mapProgramScheduleToBriefInput(input: {
  organizationId: string
  programId: string
  programName: string
  scheduleTitle: string
  location: string | null
  startAt: string
  endAt: string
  reservationId?: string | null
}): OperationalBriefUpsertInput {
  return {
    organization_id: input.organizationId,
    source_type: OPERATIONAL_BRIEF_SOURCE_TYPES.program,
    source_id: input.programId,
    reservation_id: input.reservationId ?? null,
    title: `${input.programName} — ${input.scheduleTitle}`,
    event_date: toDateOnly(input.startAt),
    start_time: toTimeOnly(input.startAt),
    end_time: toTimeOnly(input.endAt),
    facility_notes: input.location ? `Location: ${input.location}` : null,
    setup_status: OPERATIONAL_BRIEF_SETUP_STATUSES.notStarted,
    source_status: "scheduled",
  }
}

export async function upsertOperationalBrief(
  supabase: SupabaseClient,
  input: OperationalBriefUpsertInput
) {
  const match =
    input.source_id != null
      ? {
          organization_id: input.organization_id,
          source_type: input.source_type,
          source_id: input.source_id,
        }
      : input.reservation_id
        ? { reservation_id: input.reservation_id }
        : null

  if (!match) {
    throw new Error("Operational brief requires source_id or reservation_id.")
  }

  const existing = await supabase
    .from("operational_briefs")
    .select("id")
    .match(match)
    .maybeSingle()

  if (existing.error && existing.error.code !== "PGRST116") {
    throw existing.error
  }

  if (existing.data?.id) {
    const { error } = await supabase
      .from("operational_briefs")
      .update({
        title: input.title,
        event_date: input.event_date ?? null,
        start_time: input.start_time ?? null,
        end_time: input.end_time ?? null,
        reservation_id: input.reservation_id ?? null,
        primary_contact_person_id: input.primary_contact_person_id ?? null,
        primary_contact_name: input.primary_contact_name ?? null,
        primary_contact_phone: input.primary_contact_phone ?? null,
        special_requests: input.special_requests ?? null,
        source_status: input.source_status ?? null,
        updated_by: input.updated_by ?? null,
      })
      .eq("id", existing.data.id)

    if (error) throw error
    return existing.data.id as string
  }

  const { data, error } = await supabase
    .from("operational_briefs")
    .insert({
      ...input,
      setup_status: input.setup_status ?? OPERATIONAL_BRIEF_SETUP_STATUSES.notStarted,
    })
    .select("id")
    .single()

  if (error) throw error
  return data.id as string
}

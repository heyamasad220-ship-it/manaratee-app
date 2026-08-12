import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

import {
  mapInternalEventRowToBriefInput,
  mapMaintenanceReservationToBriefInput,
  mapProgramScheduleToBriefInput,
  mapVenueRentalRowToBriefInput,
  upsertOperationalBrief,
} from "./operational-brief-sync"
import { resolveContactById, resolveContactForAuthUser } from "./operational-brief-contact-resolver"
import {
  mergeOperationalSetupIntoUpsert,
  type OperationalSetupInput,
} from "./operational-setup-input"
import {
  OPERATIONAL_BRIEF_SETUP_STATUSES,
  type OperationalBriefRecord,
} from "./operational-brief-types"

export async function syncOperationalBriefForInternalEvent(
  eventId: string,
  organizationId?: string,
  options?: { operationalSetup?: OperationalSetupInput }
) {
  const supabase = await createClient()
  const orgId = organizationId ?? (await getSelectedOrganizationId())
  if (!orgId) return

  const { data: event, error } = await supabase
    .from("internal_events")
    .select(
      "id, name, description, status, start_at, end_at, venue_id, location_label, created_by, venues(name)"
    )
    .eq("id", eventId)
    .eq("organization_id", orgId)
    .maybeSingle()

  if (error || !event) return

  const reservation = await supabase
    .from("resource_reservations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("source_type", "internal_event")
    .eq("source_id", eventId)
    .maybeSingle()

  const venueRel = event.venues as { name: string } | { name: string }[] | null
  const venueName = Array.isArray(venueRel) ? venueRel[0]?.name : venueRel?.name

  const coordinator = await resolveContactForAuthUser(
    supabase,
    orgId,
    event.created_by
  )

  const briefInput = mergeOperationalSetupIntoUpsert(
    mapInternalEventRowToBriefInput({
      organizationId: orgId,
      event,
      venueName,
      reservationId: reservation.data?.id ?? null,
      internalCoordinator: coordinator,
    }),
    options?.operationalSetup
  )

  await upsertOperationalBrief(supabase, briefInput)
}

export async function syncOperationalBriefForVenueRental(
  venueRentalId: string,
  organizationId?: string,
  updatedBy?: string | null,
  options?: { operationalSetup?: OperationalSetupInput }
) {
  const supabase = await createClient()
  const orgId = organizationId ?? (await getSelectedOrganizationId())
  if (!orgId) return

  const rentalSelectWithBilling =
    "id, status, notes, customer_user_id, billing_contact_id, created_by, venue_rental_event_types(name)"
  const rentalSelectBase =
    "id, status, notes, customer_user_id, created_by, venue_rental_event_types(name)"

  let { data: rental, error } = await supabase
    .from("venue_rentals")
    .select(rentalSelectWithBilling)
    .eq("id", venueRentalId)
    .eq("organization_id", orgId)
    .maybeSingle()

  if (error?.message?.includes("billing_contact_id")) {
    const fallback = await supabase
      .from("venue_rentals")
      .select(rentalSelectBase)
      .eq("id", venueRentalId)
      .eq("organization_id", orgId)
      .maybeSingle()
    rental = fallback.data
      ? { ...fallback.data, billing_contact_id: null }
      : null
    error = fallback.error
  }

  if (error || !rental) return

  const { data: reservations } = await supabase
    .from("rental_reservations")
    .select("start_at, end_at, venues(name)")
    .eq("venue_rental_id", venueRentalId)
    .eq("organization_id", orgId)
    .order("start_at", { ascending: true })

  const customerContact = rental.billing_contact_id
    ? await resolveContactById(supabase, orgId, rental.billing_contact_id as string)
    : rental.customer_user_id
      ? await resolveContactForAuthUser(supabase, orgId, rental.customer_user_id)
      : null

  const resourceReservation = await supabase
    .from("resource_reservations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("source_type", "venue_rental")
    .filter("metadata->>venue_rental_id", "eq", venueRentalId)
    .limit(1)
    .maybeSingle()

  const eventTypeRel = rental.venue_rental_event_types as
    | { name: string }
    | { name: string }[]
    | null
  const eventTypeName = Array.isArray(eventTypeRel)
    ? eventTypeRel[0]?.name
    : eventTypeRel?.name

  const spaces =
    reservations?.map((row) => {
      const venueRel = row.venues as { name: string } | { name: string }[] | null
      const venueName = Array.isArray(venueRel) ? venueRel[0]?.name : venueRel?.name
      return {
        venueName: venueName ?? "Space",
        start_at: row.start_at as string,
        end_at: row.end_at as string,
      }
    }) ?? []

  const briefInput = mergeOperationalSetupIntoUpsert(
    mapVenueRentalRowToBriefInput({
      organizationId: orgId,
      rental,
      eventTypeName,
      spaces,
      customerContact,
      reservationId: resourceReservation.data?.id ?? null,
      updatedBy,
    }),
    options?.operationalSetup
  )

  await upsertOperationalBrief(supabase, briefInput)
}

export async function syncOperationalBriefForMaintenanceReservation(
  reservationId: string,
  organizationId?: string,
  createdBy?: string | null
) {
  const supabase = await createClient()
  const orgId = organizationId ?? (await getSelectedOrganizationId())
  if (!orgId) return

  const { data: reservation, error } = await supabase
    .from("resource_reservations")
    .select(
      "id, title, description, start_at, end_at, source_type, status, venue_id, space_label, venues(name)"
    )
    .eq("id", reservationId)
    .eq("organization_id", orgId)
    .maybeSingle()

  if (error || !reservation) return

  const venueRel = reservation.venues as { name: string } | { name: string }[] | null
  const venueName = Array.isArray(venueRel) ? venueRel[0]?.name : venueRel?.name

  await upsertOperationalBrief(
    supabase,
    mapMaintenanceReservationToBriefInput({
      organizationId: orgId,
      reservation,
      venueName,
      createdBy,
    })
  )
}

export async function syncOperationalBriefForProgramSchedule(input: {
  programId: string
  programName: string
  scheduleTitle: string
  location: string | null
  startAt: string
  endAt: string
  reservationId?: string | null
  organizationId?: string
}) {
  const supabase = await createClient()
  const orgId = input.organizationId ?? (await getSelectedOrganizationId())
  if (!orgId) return

  await upsertOperationalBrief(
    supabase,
    mapProgramScheduleToBriefInput({
      organizationId: orgId,
      programId: input.programId,
      programName: input.programName,
      scheduleTitle: input.scheduleTitle,
      location: input.location,
      startAt: input.startAt,
      endAt: input.endAt,
      reservationId: input.reservationId ?? null,
    })
  )
}

export async function getOperationalBriefById(
  briefId: string
): Promise<OperationalBriefRecord | null> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return null

  const { data, error } = await supabase
    .from("operational_briefs")
    .select("*")
    .eq("id", briefId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error || !data) return null
  return data as OperationalBriefRecord
}

export async function getOperationalBriefBySource(
  sourceType: OperationalBriefRecord["source_type"],
  sourceId: string
): Promise<OperationalBriefRecord | null> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return null

  const { data, error } = await supabase
    .from("operational_briefs")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .maybeSingle()

  if (error || !data) return null
  return data as OperationalBriefRecord
}

export async function getOperationalBriefByReservationId(
  reservationId: string
): Promise<OperationalBriefRecord | null> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return null

  const { data, error } = await supabase
    .from("operational_briefs")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("reservation_id", reservationId)
    .maybeSingle()

  if (error || !data) return null
  return data as OperationalBriefRecord
}

export async function countOperationalBriefsNeedingReview(
  organizationId?: string
): Promise<number> {
  const supabase = await createClient()
  const orgId = organizationId ?? (await getSelectedOrganizationId())
  if (!orgId) return 0

  const { count, error } = await supabase
    .from("operational_briefs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .in("setup_status", [
      OPERATIONAL_BRIEF_SETUP_STATUSES.needsReview,
      OPERATIONAL_BRIEF_SETUP_STATUSES.issueReported,
    ])

  if (error) return 0
  return count ?? 0
}

export type UpcomingOperationalBriefRow = {
  id: string
  title: string
  sourceType: string
  sourceId: string | null
  eventDate: string | null
  startTime: string | null
  setupStatus: string
  sourceStatus: string | null
}

export async function getUpcomingOperationalBriefs(
  limit = 12
): Promise<UpcomingOperationalBriefRow[]> {
  const supabase = await createClient()
  const orgId = await getSelectedOrganizationId()
  if (!orgId) return []

  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from("operational_briefs")
    .select("id, title, source_type, source_id, event_date, start_time, setup_status, source_status")
    .eq("organization_id", orgId)
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(limit)

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    sourceType: row.source_type as string,
    sourceId: (row.source_id as string | null) ?? null,
    eventDate: row.event_date as string | null,
    startTime: row.start_time as string | null,
    setupStatus: row.setup_status as string,
    sourceStatus: row.source_status as string | null,
  }))
}

export type TemporaryHoldRow = {
  id: string
  venueRentalId: string
  shortLabel: string
  venueName: string
  startAt: string
  endAt: string
  holdExpiresAt: string | null
}

export async function getActiveTemporaryHolds(limit = 10): Promise<TemporaryHoldRow[]> {
  const supabase = await createClient()
  const orgId = await getSelectedOrganizationId()
  if (!orgId) return []

  const { data, error } = await supabase
    .from("rental_reservations")
    .select(
      "id, venue_rental_id, start_at, end_at, hold_expires_at, venues(name), venue_rentals(id, status, hold_expires_at)"
    )
    .eq("organization_id", orgId)
    .eq("status", "temporary_hold")
    .order("start_at", { ascending: true })
    .limit(limit)

  if (error || !data) return []

  return data.map((row) => {
    const venueRel = row.venues as { name: string } | { name: string }[] | null
    const venueName = Array.isArray(venueRel) ? venueRel[0]?.name : venueRel?.name
    const rentalRel = row.venue_rentals as
      | { id: string; hold_expires_at: string | null }
      | { id: string; hold_expires_at: string | null }[]
      | null
    const rental = Array.isArray(rentalRel) ? rentalRel[0] : rentalRel

    return {
      id: row.id as string,
      venueRentalId: row.venue_rental_id as string,
      shortLabel: (row.venue_rental_id as string).slice(0, 8),
      venueName: venueName ?? "Space",
      startAt: row.start_at as string,
      endAt: row.end_at as string,
      holdExpiresAt: (row.hold_expires_at as string | null) ?? rental?.hold_expires_at ?? null,
    }
  })
}

export async function syncOperationalBriefForProgram(
  programId: string,
  organizationId?: string
) {
  const supabase = await createClient()
  const orgId = organizationId ?? (await getSelectedOrganizationId())
  if (!orgId) return

  const { data: program, error: programError } = await supabase
    .from("programs")
    .select("id, name")
    .eq("id", programId)
    .eq("organization_id", orgId)
    .maybeSingle()

  if (programError || !program) return

  const { data: scheduleItems } = await supabase
    .from("program_schedule_items")
    .select("title, location, day_of_week, start_time, end_time")
    .eq("program_id", programId)
    .eq("organization_id", orgId)
    .order("day_of_week", { ascending: true })
    .limit(1)

  const schedule = scheduleItems?.[0]
  if (!schedule) {
    await upsertOperationalBrief(
      supabase,
      mapProgramScheduleToBriefInput({
        organizationId: orgId,
        programId,
        programName: program.name as string,
        scheduleTitle: "Program schedule",
        location: null,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
    )
    return
  }

  const dayIndex = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(
    (schedule.day_of_week as string).toLowerCase()
  )
  const cursor = new Date()
  if (dayIndex >= 0) {
    const delta = (dayIndex - cursor.getDay() + 7) % 7
    cursor.setDate(cursor.getDate() + delta)
  }

  const [startHour, startMinute] = (schedule.start_time as string).split(":").map(Number)
  const [endHour, endMinute] = (schedule.end_time as string).split(":").map(Number)
  const startAt = new Date(cursor)
  startAt.setHours(startHour, startMinute, 0, 0)
  const endAt = new Date(cursor)
  endAt.setHours(endHour, endMinute, 0, 0)
  if (endAt <= startAt) {
    endAt.setTime(startAt.getTime() + 60 * 60 * 1000)
  }

  await upsertOperationalBrief(
    supabase,
    mapProgramScheduleToBriefInput({
      organizationId: orgId,
      programId,
      programName: program.name as string,
      scheduleTitle: schedule.title as string,
      location: schedule.location as string | null,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    })
  )
}

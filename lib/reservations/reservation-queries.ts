import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"
import {
  type VenueUsageTag,
} from "@/lib/bookings/venue-usage"

import { reservationStatusBlocksBooking } from "./reservation-conflict-rules"

import {
  combineDateAndTime,
  dayNameToIndex,
  getDayEnd,
  getWeekEnd,
  getWeekStart,
  rangesOverlap,
} from "./reservation-time"
import type {
  CalendarContext,
  CalendarData,
  CalendarReservation,
  CalendarVenue,
  CalendarViewMode,
  ReservationSourceType,
} from "./reservation-types"
import {
  getSourceTypesForContext,
  RESERVATION_SOURCE_TYPES,
} from "./reservation-types"

type ResourceReservationRow = {
  id: string
  organization_id: string
  venue_id: string | null
  space_label: string | null
  title: string
  description: string | null
  start_at: string
  end_at: string
  source_type: ReservationSourceType
  source_id: string | null
  status: string
  metadata: Record<string, unknown> | null
  venues?: { id: string; name: string } | null
}

type ProgramScheduleRow = {
  id: string
  organization_id: string
  program_id: string
  title: string
  day_of_week: string
  start_time: string
  end_time: string
  location: string | null
  programs?: { name: string } | null
}

function getRangeForView(view: CalendarViewMode, anchorDate: Date) {
  if (view === "day") {
    const start = new Date(anchorDate)
    start.setHours(0, 0, 0, 0)
    return { start, end: getDayEnd(anchorDate) }
  }

  return { start: getWeekStart(anchorDate), end: getWeekEnd(anchorDate) }
}

function reservationHref(
  sourceType: ReservationSourceType,
  sourceId: string | null,
  metadata?: Record<string, unknown> | null
) {
  if (!sourceId) return null

  switch (sourceType) {
    case RESERVATION_SOURCE_TYPES.internalEvent:
      return `/event-management/${sourceId}`
    case RESERVATION_SOURCE_TYPES.venueRental: {
      const venueRentalId = metadata?.venue_rental_id
      if (typeof venueRentalId === "string") {
        return `/bookings/rentals/${venueRentalId}`
      }
      return `/bookings/overview`
    }
    default:
      return null
  }
}

function mapReservationRow(row: ResourceReservationRow): CalendarReservation {
  return {
    id: row.id,
    organizationId: row.organization_id,
    venueId: row.venue_id,
    venueName: row.venues?.name ?? null,
    spaceLabel: row.space_label,
    title: row.title,
    description: row.description,
    startAt: row.start_at,
    endAt: row.end_at,
    sourceType: row.source_type,
    sourceId: row.source_id,
    status: row.status,
    metadata: row.metadata ?? {},
    href: reservationHref(row.source_type, row.source_id, row.metadata),
  }
}

function expandProgramScheduleRows(
  rows: ProgramScheduleRow[],
  rangeStart: Date,
  rangeEnd: Date
): CalendarReservation[] {
  const reservations: CalendarReservation[] = []
  const cursor = new Date(rangeStart)
  cursor.setHours(0, 0, 0, 0)

  while (cursor <= rangeEnd) {
    for (const row of rows) {
      const dayIndex = dayNameToIndex(row.day_of_week)
      if (dayIndex === null || cursor.getDay() !== dayIndex) {
        continue
      }

      const startAt = combineDateAndTime(cursor, row.start_time)
      let endAt = combineDateAndTime(cursor, row.end_time)
      if (endAt <= startAt) {
        endAt = new Date(startAt.getTime() + 60 * 60 * 1000)
      }

      if (!rangesOverlap(startAt, endAt, rangeStart, rangeEnd)) {
        continue
      }

      reservations.push({
        id: `program-schedule-${row.id}-${cursor.toISOString().slice(0, 10)}`,
        organizationId: row.organization_id,
        venueId: null,
        venueName: null,
        spaceLabel: row.location,
        title: row.programs?.name
          ? `${row.programs.name}: ${row.title}`
          : row.title,
        description: null,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        sourceType: RESERVATION_SOURCE_TYPES.programFacility,
        sourceId: row.id,
        status: "active",
        metadata: {
          program_id: row.program_id,
          program_name: row.programs?.name ?? null,
          schedule_title: row.title,
        },
        href: `/programs/${row.program_id}`,
      })
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return reservations
}

export type GetCalendarVenuesOptions = {
  usageTags?: VenueUsageTag[]
  activeOnly?: boolean
}

export async function getCalendarVenues(
  options?: GetCalendarVenuesOptions
): Promise<CalendarVenue[]> {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    return []
  }

  let query = supabase
    .from("venues")
    .select("id, name, usage_tag, status")
    .eq("organization_id", organizationId)

  if (options?.usageTags?.length) {
    query = query.in("usage_tag", options.usageTags)
  }

  if (options?.activeOnly) {
    query = query.eq("status", "active")
  }

  const { data, error } = await query.order("name", { ascending: true })

  if (error) {
    if (error.message?.includes("usage_tag")) {
      const fallback = await supabase
        .from("venues")
        .select("id, name, status")
        .eq("organization_id", organizationId)
        .order("name", { ascending: true })

      if (fallback.error) {
        console.error(fallback.error)
        return []
      }

      return (fallback.data || []) as CalendarVenue[]
    }

    console.error(error)
    return []
  }

  return (data || []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
  }))
}

async function getStoredReservations(
  organizationId: string,
  rangeStart: Date,
  rangeEnd: Date,
  sourceTypes: ReservationSourceType[] | null
) {
  const supabase = await createClient()

  let query = supabase
    .from("resource_reservations")
    .select(
      `
      id,
      organization_id,
      venue_id,
      space_label,
      title,
      description,
      start_at,
      end_at,
      source_type,
      source_id,
      status,
      metadata,
      venues:venue_id ( id, name )
    `
    )
    .eq("organization_id", organizationId)
    .lt("start_at", rangeEnd.toISOString())
    .gt("end_at", rangeStart.toISOString())
    .order("start_at", { ascending: true })

  if (sourceTypes) {
    query = query.in("source_type", sourceTypes)
  }

  const { data, error } = await query

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    console.error(error)
    throw new Error("Failed to load reservations")
  }

  return ((data || []) as ResourceReservationRow[]).map(mapReservationRow)
}

async function getProgramFacilityReservations(
  organizationId: string,
  rangeStart: Date,
  rangeEnd: Date
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("program_schedule_items")
    .select(
      `
      id,
      organization_id,
      program_id,
      title,
      day_of_week,
      start_time,
      end_time,
      location,
      programs:program_id ( name )
    `
    )
    .eq("organization_id", organizationId)

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    console.error(error)
    return []
  }

  return expandProgramScheduleRows(
    (data || []) as ProgramScheduleRow[],
    rangeStart,
    rangeEnd
  )
}

export async function getCalendarData(
  context: CalendarContext,
  anchorDate: Date,
  view: CalendarViewMode = "week"
): Promise<CalendarData> {
  const organizationId = await resolveOrganizationId()
  const { start, end } = getRangeForView(view, anchorDate)
  const sourceTypes = getSourceTypesForContext(context)

  if (!organizationId) {
    return {
      venues: [],
      reservations: [],
      rangeStart: start.toISOString(),
      rangeEnd: end.toISOString(),
    }
  }

  const [venues, storedReservations, programReservations] = await Promise.all([
    getCalendarVenues(),
    getStoredReservations(organizationId, start, end, sourceTypes),
    context === "facilities"
      ? getProgramFacilityReservations(organizationId, start, end)
      : Promise.resolve([]),
  ])

  const reservations = [...storedReservations, ...programReservations].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  )

  return {
    venues,
    reservations,
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
  }
}

export async function getConflictingReservations(
  organizationId: string,
  venueId: string | null,
  spaceLabel: string | null,
  startAt: string,
  endAt: string,
  excludeReservationId?: string
) {
  const supabase = await createClient()

  let query = supabase
    .from("resource_reservations")
    .select("id, title, source_type, start_at, end_at, venue_id, space_label, status")
    .eq("organization_id", organizationId)
    .lt("start_at", endAt)
    .gt("end_at", startAt)

  if (excludeReservationId) {
    query = query.neq("id", excludeReservationId)
  }

  const { data, error } = await query

  if (error) {
    console.error(error)
    return []
  }

  return (data || []).filter((row) => {
    if (!reservationStatusBlocksBooking(row.status as string)) {
      return false
    }

    if (venueId) {
      return row.venue_id === venueId
    }

    if (spaceLabel) {
      return (row.space_label || "").toLowerCase() === spaceLabel.toLowerCase()
    }

    return true
  })
}

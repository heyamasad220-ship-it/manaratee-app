import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"

import { reservationStatusBlocksBooking, type ConflictCheckReservation } from "./reservation-conflict-rules"

import {
  combineDateAndTime,
  dayNameToIndex,
  getDayEnd,
  getWeekEnd,
  getWeekStart,
  rangesOverlap,
  toDateParam,
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
  audienceIncludesProgramSchedules,
  audienceShowsAllSourceTypes,
  getVenueOptionsForAudience,
  maskCalendarData,
  type CalendarAudience,
} from "./calendar-audience"
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
  offering_id?: string | null
  title: string
  day_of_week: string
  start_time: string
  end_time: string
  location: string | null
  venue_id?: string | null
  offering_start_date?: string | null
  offering_end_date?: string | null
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
  rangeEnd: Date,
  venueNameById?: Map<string, string>
): CalendarReservation[] {
  const reservations: CalendarReservation[] = []
  const cursor = new Date(rangeStart)
  cursor.setHours(0, 0, 0, 0)

  while (cursor <= rangeEnd) {
    const cursorDateKey = toDateParam(cursor)

    for (const row of rows) {
      const dayIndex = dayNameToIndex(row.day_of_week)
      if (dayIndex === null || cursor.getDay() !== dayIndex) {
        continue
      }

      if (row.offering_start_date && cursorDateKey < row.offering_start_date) {
        continue
      }
      if (row.offering_end_date && cursorDateKey > row.offering_end_date) {
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

      const venueId = row.venue_id || null
      const venueName = venueId ? venueNameById?.get(venueId) ?? null : null
      const programName = Array.isArray(row.programs)
        ? row.programs[0]?.name
        : row.programs?.name

      reservations.push({
        id: `program-schedule-${row.id}-${cursorDateKey}`,
        organizationId: row.organization_id,
        venueId,
        venueName,
        spaceLabel: row.location || venueName,
        title: programName ? `${programName}: ${row.title}` : row.title,
        description: null,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        sourceType: RESERVATION_SOURCE_TYPES.programFacility,
        sourceId: row.id,
        status: "active",
        metadata: {
          program_id: row.program_id,
          offering_id: row.offering_id ?? null,
          program_name: programName ?? null,
          schedule_title: row.title,
          venue_id: venueId,
        },
        href: `/programs/${row.program_id}`,
      })
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return reservations
}

export type GetCalendarVenuesOptions = {
  bookableOnly?: boolean
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
    .select("id, name, available_for_bookings, usage_tag, status")
    .eq("organization_id", organizationId)

  if (options?.bookableOnly) {
    query = query.eq("available_for_bookings", true)
  }

  if (options?.activeOnly) {
    query = query.eq("status", "active")
  }

  const { data, error } = await query.order("name", { ascending: true })

  if (error) {
    if (
      error.message?.includes("available_for_bookings") ||
      error.message?.includes("usage_tag")
    ) {
      let fallbackQuery = supabase
        .from("venues")
        .select("id, name, status")
        .eq("organization_id", organizationId)

      if (options?.activeOnly) {
        fallbackQuery = fallbackQuery.eq("status", "active")
      }

      const fallback = await fallbackQuery.order("name", { ascending: true })

      if (fallback.error) {
        console.error(fallback.error)
        return []
      }

      const rows = fallback.data || []

      if (options?.bookableOnly) {
        return []
      }

      return rows.map((row) => ({
        id: row.id as string,
        name: row.name as string,
      }))
    }

    console.error(error)
    return []
  }

  let rows = data || []

  if (options?.bookableOnly) {
    rows = rows.filter((row) => row.available_for_bookings === true)
  }

  return rows.map((row) => ({
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

  const withOfferingSelect = `
      id,
      organization_id,
      program_id,
      offering_id,
      title,
      day_of_week,
      start_time,
      end_time,
      location,
      venue_id,
      programs:program_id ( name ),
      program_offerings:offering_id ( start_date, end_date )
    `

  let { data, error } = await supabase
    .from("program_schedule_items")
    .select(withOfferingSelect)
    .eq("organization_id", organizationId)

  if (error?.message?.includes("venue_id") || error?.code === "42703") {
    const fallback = await supabase
      .from("program_schedule_items")
      .select(
        `
      id,
      organization_id,
      program_id,
      offering_id,
      title,
      day_of_week,
      start_time,
      end_time,
      location,
      programs:program_id ( name ),
      program_offerings:offering_id ( start_date, end_date )
    `
      )
      .eq("organization_id", organizationId)
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    console.error(error)
    return []
  }

  const { data: venues } = await supabase
    .from("venues")
    .select("id, name")
    .eq("organization_id", organizationId)

  const venueNameById = new Map(
    (venues || []).map((venue) => [venue.id as string, venue.name as string])
  )

  const rows: ProgramScheduleRow[] = (data || []).map((row: any) => {
    const offering = Array.isArray(row.program_offerings)
      ? row.program_offerings[0]
      : row.program_offerings
    return {
      id: row.id,
      organization_id: row.organization_id,
      program_id: row.program_id,
      offering_id: row.offering_id ?? null,
      title: row.title,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      location: row.location,
      venue_id: row.venue_id ?? null,
      offering_start_date: offering?.start_date ?? null,
      offering_end_date: offering?.end_date ?? null,
      programs: row.programs,
    }
  })

  return expandProgramScheduleRows(rows, rangeStart, rangeEnd, venueNameById)
}

export type GetCalendarDataOptions = {
  /**
   * Optional filter of source types for module calendar views.
   * Still reads from the shared schedule (resource_reservations + program expand).
   * Pass null/omit for the full Facilities calendar.
   */
  sourceTypes?: ReservationSourceType[] | null
}

function resolveStoredSourceTypes(
  audience: CalendarAudience,
  sourceTypes: ReservationSourceType[] | null | undefined
): ReservationSourceType[] | null {
  if (sourceTypes !== undefined && sourceTypes !== null) {
    return sourceTypes.filter(
      (type) => type !== RESERVATION_SOURCE_TYPES.programFacility
    )
  }

  if (audienceShowsAllSourceTypes(audience)) {
    return null
  }

  return getSourceTypesForContext("venue_rentals")
}

function shouldIncludeProgramSchedules(
  audience: CalendarAudience,
  sourceTypes: ReservationSourceType[] | null | undefined
) {
  if (!audienceIncludesProgramSchedules(audience)) {
    return false
  }

  if (sourceTypes === undefined || sourceTypes === null) {
    return true
  }

  return sourceTypes.includes(RESERVATION_SOURCE_TYPES.programFacility)
}

export async function getCalendarData(
  audience: CalendarAudience,
  anchorDate: Date,
  view: CalendarViewMode = "grid",
  options?: GetCalendarDataOptions
): Promise<CalendarData> {
  const organizationId = await resolveOrganizationId()
  const { start, end } = getRangeForView(view, anchorDate)
  const sourceTypes = options?.sourceTypes
  const storedSourceTypes = resolveStoredSourceTypes(audience, sourceTypes)

  if (!organizationId) {
    return {
      venues: [],
      reservations: [],
      rangeStart: start.toISOString(),
      rangeEnd: end.toISOString(),
    }
  }

  const venueOptions = getVenueOptionsForAudience(audience)

  const [venues, storedReservations, programReservations] = await Promise.all([
    getCalendarVenues(venueOptions),
    getStoredReservations(organizationId, start, end, storedSourceTypes),
    shouldIncludeProgramSchedules(audience, sourceTypes)
      ? getProgramFacilityReservations(organizationId, start, end)
      : Promise.resolve([]),
  ])

  const reservations = [...storedReservations, ...programReservations].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  )

  return maskCalendarData(
    {
      venues,
      reservations,
      rangeStart: start.toISOString(),
      rangeEnd: end.toISOString(),
    },
    audience
  )
}

/** @deprecated Use getCalendarData with CalendarAudience instead */
export async function getCalendarDataByContext(
  context: CalendarContext,
  anchorDate: Date,
  view: CalendarViewMode = "grid"
): Promise<CalendarData> {
  const audience =
    context === "facilities"
      ? "ops"
      : context === "venue_rentals"
        ? "staff"
        : "staff"

  return getCalendarData(audience, anchorDate, view)
}

function locationMatchesVenueName(
  location: string | null | undefined,
  venueName: string | null | undefined
) {
  const loc = location?.trim().toLowerCase()
  const name = venueName?.trim().toLowerCase()
  if (!loc || !name) return false
  return loc === name || loc.includes(name) || name.includes(loc)
}

/**
 * Expand recurring program schedule rows into blocking slots for a venue.
 * Programs store a free-text location; match against the venue name.
 */
export async function getProgramBlockingReservationsForVenue(
  organizationId: string,
  venueId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<ConflictCheckReservation[]> {
  const supabase = await createClient()

  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("id", venueId)
    .maybeSingle()

  if (venueError || !venue?.name) {
    return []
  }

  const start = new Date(rangeStart)
  const end = new Date(rangeEnd)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return []
  }

  const programRows = await getProgramFacilityReservations(organizationId, start, end)

  return programRows
    .filter((row) => {
      if (row.venueId) {
        return row.venueId === venueId
      }
      return locationMatchesVenueName(row.spaceLabel, venue.name as string)
    })
    .map((row) => ({
      id: row.id,
      venueId,
      startAt: row.startAt,
      endAt: row.endAt,
      status: row.status,
    }))
}

/** Program slots matched to venues by location name — for public availability calendars. */
export async function getProgramAvailabilityBlocksForOrg(
  organizationId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<Array<{ venueId: string; startAt: string; endAt: string }>> {
  const supabase = await createClient()
  const start = new Date(rangeStart)
  const end = new Date(rangeEnd)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return []
  }

  const [{ data: venues }, programRows] = await Promise.all([
    supabase
      .from("venues")
      .select("id, name")
      .eq("organization_id", organizationId),
    getProgramFacilityReservations(organizationId, start, end),
  ])

  if (!venues?.length || !programRows.length) {
    return []
  }

  const blocks: Array<{ venueId: string; startAt: string; endAt: string }> = []

  for (const row of programRows) {
    if (row.venueId) {
      blocks.push({
        venueId: row.venueId,
        startAt: row.startAt,
        endAt: row.endAt,
      })
      continue
    }

    for (const venue of venues) {
      if (!locationMatchesVenueName(row.spaceLabel, venue.name as string)) {
        continue
      }
      blocks.push({
        venueId: venue.id as string,
        startAt: row.startAt,
        endAt: row.endAt,
      })
    }
  }

  return blocks
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
    .select("id, title, source_type, source_id, start_at, end_at, venue_id, space_label, status")
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

  const stored = (data || []).filter((row) => {
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

  if (!venueId) {
    return stored
  }

  const programBlocks = await getProgramBlockingReservationsForVenue(
    organizationId,
    venueId,
    startAt,
    endAt
  )

  const programAsRows = programBlocks.map((block) => ({
    id: block.id,
    title: "Program",
    source_type: RESERVATION_SOURCE_TYPES.programFacility,
    start_at: block.startAt,
    end_at: block.endAt,
    venue_id: venueId,
    space_label: null as string | null,
    status: block.status,
  }))

  return [...stored, ...programAsRows]
}

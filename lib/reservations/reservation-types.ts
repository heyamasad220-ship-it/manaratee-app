export const RESERVATION_SOURCE_TYPES = {
  venueRental: "venue_rental",
  internalEvent: "internal_event",
  programFacility: "program_facility",
  maintenanceBlock: "maintenance_block",
  spaceClosure: "space_closure",
} as const

export type ReservationSourceType =
  (typeof RESERVATION_SOURCE_TYPES)[keyof typeof RESERVATION_SOURCE_TYPES]

export type CalendarContext = "venue_rentals" | "internal_events" | "facilities"

export type CalendarViewMode = "day" | "grid"

export interface CalendarVenue {
  id: string
  name: string
}

export interface CalendarReservation {
  id: string
  organizationId: string
  venueId: string | null
  venueName: string | null
  spaceLabel: string | null
  title: string
  description: string | null
  startAt: string
  endAt: string
  sourceType: ReservationSourceType
  sourceId: string | null
  status: string
  metadata: Record<string, unknown>
  href: string | null
}

export interface CalendarData {
  venues: CalendarVenue[]
  reservations: CalendarReservation[]
  rangeStart: string
  rangeEnd: string
}

export const CALENDAR_CONTEXT_LABELS: Record<CalendarContext, string> = {
  venue_rentals: "Venue Rentals",
  internal_events: "Event Management",
  facilities: "Schedule",
}

export const CALENDAR_CONTEXT_DESCRIPTIONS: Record<CalendarContext, string> = {
  venue_rentals: "Customer venue rental reservations only",
  internal_events: "Internal department-owned events only",
  facilities: "All reservations, programs, maintenance, and closures",
}

export const SOURCE_TYPE_LABELS: Record<ReservationSourceType, string> = {
  venue_rental: "Venue Rental",
  internal_event: "Internal Event",
  program_facility: "Program Facility",
  maintenance_block: "Maintenance Block",
  space_closure: "Space Closure",
}

export const SOURCE_TYPE_COLORS: Record<
  ReservationSourceType,
  { bg: string; text: string; border: string }
> = {
  venue_rental: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-200",
  },
  internal_event: {
    bg: "bg-violet-100",
    text: "text-violet-800",
    border: "border-violet-200",
  },
  program_facility: {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-200",
  },
  maintenance_block: {
    bg: "bg-slate-200",
    text: "text-slate-800",
    border: "border-slate-300",
  },
  space_closure: {
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-200",
  },
}

export function getSourceTypesForContext(
  context: CalendarContext
): ReservationSourceType[] | null {
  switch (context) {
    case "venue_rentals":
      return [RESERVATION_SOURCE_TYPES.venueRental]
    case "internal_events":
      return [RESERVATION_SOURCE_TYPES.internalEvent]
    case "facilities":
      return null
    default:
      return null
  }
}

import type {
  CalendarData,
  CalendarReservation,
  ReservationSourceType,
} from "@/lib/reservations/reservation-types"
import { SOURCE_TYPE_LABELS } from "@/lib/reservations/reservation-types"

/** Who is viewing the shared facility calendar (controls masking + venue options). */
export type CalendarAudience = "staff" | "ops" | "customer"

export const CALENDAR_AUDIENCE_LABELS: Record<CalendarAudience, string> = {
  staff: "Calendar",
  ops: "Calendar",
  customer: "Book a Space",
}

export const CALENDAR_AUDIENCE_DESCRIPTIONS: Record<CalendarAudience, string> = {
  staff:
    "See when spaces are open or reserved so you can plan events and programs.",
  ops:
    "Full schedule across rentals, events, programs, and maintenance — with setup briefs and conflict detection.",
  customer:
    "Check open times and request a venue rental for bookable spaces only.",
}

export const CALENDAR_AUDIENCE_PATHS: Record<CalendarAudience, string> = {
  staff: "/facilities/calendar",
  ops: "/facilities/calendar",
  customer: "/customer/rentals/new",
}

export function maskCalendarReservation(
  reservation: CalendarReservation,
  audience: CalendarAudience
): CalendarReservation {
  if (audience === "ops") {
    return reservation
  }

  const label = getMaskedReservationTitle(reservation.sourceType)

  return {
    ...reservation,
    title: label,
    description: null,
    href: null,
    metadata: {},
  }
}

export function maskCalendarData(
  data: CalendarData,
  audience: CalendarAudience
): CalendarData {
  if (audience === "ops") {
    return data
  }

  return {
    ...data,
    reservations: data.reservations.map((reservation) =>
      maskCalendarReservation(reservation, audience)
    ),
  }
}

function getMaskedReservationTitle(sourceType: ReservationSourceType) {
  return SOURCE_TYPE_LABELS[sourceType] || "Reserved"
}

export function getVenueOptionsForAudience(audience: CalendarAudience) {
  switch (audience) {
    case "customer":
      return { bookableOnly: true, activeOnly: true }
    case "staff":
    case "ops":
      return { activeOnly: true }
    default:
      return { activeOnly: true }
  }
}

export function audienceIncludesProgramSchedules(audience: CalendarAudience) {
  return audience === "staff" || audience === "ops"
}

export function audienceShowsAllSourceTypes(audience: CalendarAudience) {
  return audience === "staff" || audience === "ops"
}

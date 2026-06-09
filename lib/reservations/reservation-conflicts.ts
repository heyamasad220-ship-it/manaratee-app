import { rangesOverlap } from "./reservation-time"
import { reservationStatusBlocksBooking } from "./reservation-conflict-rules"
import type {
  CalendarReservation,
  CalendarVenue,
} from "./reservation-types"

function normalizeSpaceLabel(value: string | null | undefined) {
  return (value || "").trim().toLowerCase()
}

export function reservationsShareSpace(
  a: CalendarReservation,
  b: CalendarReservation,
  venues: CalendarVenue[]
) {
  if (a.venueId && b.venueId) {
    return a.venueId === b.venueId
  }

  const aLabel = normalizeSpaceLabel(a.spaceLabel || a.venueName)
  const bLabel = normalizeSpaceLabel(b.spaceLabel || b.venueName)

  if (a.venueId && !b.venueId && bLabel) {
    const venue = venues.find((item) => item.id === a.venueId)
    return normalizeSpaceLabel(venue?.name) === bLabel
  }

  if (!a.venueId && b.venueId && aLabel) {
    const venue = venues.find((item) => item.id === b.venueId)
    return normalizeSpaceLabel(venue?.name) === aLabel
  }

  if (aLabel && bLabel) {
    return aLabel === bLabel
  }

  return false
}

export function computeReservationConflicts(
  reservations: CalendarReservation[],
  venues: CalendarVenue[]
) {
  const conflictIds = new Set<string>()
  const conflictPairs: Array<{ a: CalendarReservation; b: CalendarReservation }> =
    []

  for (let index = 0; index < reservations.length; index += 1) {
    const current = reservations[index]

    if (!reservationStatusBlocksBooking(current.status)) {
      continue
    }

    for (let otherIndex = index + 1; otherIndex < reservations.length; otherIndex += 1) {
      const other = reservations[otherIndex]

      if (!reservationStatusBlocksBooking(other.status)) {
        continue
      }

      if (!reservationsShareSpace(current, other, venues)) {
        continue
      }

      if (
        !rangesOverlap(
          new Date(current.startAt),
          new Date(current.endAt),
          new Date(other.startAt),
          new Date(other.endAt)
        )
      ) {
        continue
      }

      conflictIds.add(current.id)
      conflictIds.add(other.id)
      conflictPairs.push({ a: current, b: other })
    }
  }

  return {
    conflictIds,
    conflictPairs,
    conflictCount: conflictIds.size,
  }
}

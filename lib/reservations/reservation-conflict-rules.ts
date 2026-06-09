import { rangesOverlap } from "@/lib/reservations/reservation-time"

/** Reservation statuses that block double-booking for the same tenant + space. */
export const BLOCKING_RESERVATION_STATUSES = new Set([
  "temporary_hold",
  "confirmed",
  "blocked",
  // Legacy synced statuses from venue_bookings / internal_events
  "active",
  "pending_review",
  "approved",
  "deposit_pending",
  "deposit_paid",
  "fully_paid",
  "scheduled",
  "draft",
])

export type ConflictCheckReservation = {
  id: string
  venueId: string | null
  startAt: string
  endAt: string
  status: string
}

export function reservationStatusBlocksBooking(status: string | null | undefined): boolean {
  if (!status) {
    return false
  }

  const normalized = status.trim().toLowerCase()

  if (["cancelled", "rejected", "expired", "declined", "hold_expired", "closed", "refunded"].includes(normalized)) {
    return false
  }

  return BLOCKING_RESERVATION_STATUSES.has(normalized)
}

export function reservationsConflict(
  a: ConflictCheckReservation,
  b: ConflictCheckReservation
): boolean {
  if (a.id === b.id) {
    return false
  }

  if (!a.venueId || !b.venueId || a.venueId !== b.venueId) {
    return false
  }

  if (!reservationStatusBlocksBooking(a.status) || !reservationStatusBlocksBooking(b.status)) {
    return false
  }

  return rangesOverlap(
    new Date(a.startAt),
    new Date(a.endAt),
    new Date(b.startAt),
    new Date(b.endAt)
  )
}

export function findConflictingReservations(
  candidate: ConflictCheckReservation,
  existing: ConflictCheckReservation[]
): ConflictCheckReservation[] {
  return existing.filter((item) => reservationsConflict(candidate, item))
}

export function assertNoReservationConflicts(
  candidates: ConflictCheckReservation[],
  existing: ConflictCheckReservation[]
): void {
  for (const candidate of candidates) {
    const conflicts = findConflictingReservations(candidate, existing)

    if (conflicts.length > 0) {
      throw new Error(
        `Space is unavailable for the selected time (${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"}).`
      )
    }
  }

  for (let index = 0; index < candidates.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < candidates.length; otherIndex += 1) {
      if (reservationsConflict(candidates[index], candidates[otherIndex])) {
        throw new Error("Selected spaces overlap on the same venue and time.")
      }
    }
  }
}

export function filterExpiredTemporaryHolds<T extends { status: string; holdExpiresAt?: string | null }>(
  rows: T[],
  now = new Date()
): T[] {
  return rows.filter((row) => {
    if (row.status !== "temporary_hold" || !row.holdExpiresAt) {
      return true
    }

    return new Date(row.holdExpiresAt).getTime() > now.getTime()
  })
}

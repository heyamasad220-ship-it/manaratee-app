export const TERMINAL_ENROLLMENT_STATUSES = [
  "cancelled",
  "canceled",
  "withdrawn",
  "transferred",
  "expired",
  "completed",
] as const

export const ACTIVE_ENROLLMENT_STATUSES = [
  "pending_payment",
  "pending",
  "enrolled",
  "active",
] as const

export function normalizeEnrollmentStatus(status: string | null | undefined) {
  return (status || "").trim().toLowerCase()
}

export function isTerminalEnrollmentStatus(status: string | null | undefined) {
  return TERMINAL_ENROLLMENT_STATUSES.includes(
    normalizeEnrollmentStatus(status) as (typeof TERMINAL_ENROLLMENT_STATUSES)[number]
  )
}

/** Statuses that block registering the same participant again for a program. */
export function enrollmentStatusBlocksDuplicate(
  status: string | null | undefined
) {
  const normalized = normalizeEnrollmentStatus(status)
  return (
    !isTerminalEnrollmentStatus(normalized) &&
    ACTIVE_ENROLLMENT_STATUSES.includes(
      normalized as (typeof ACTIVE_ENROLLMENT_STATUSES)[number]
    )
  )
}

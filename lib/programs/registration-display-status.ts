/** Client-safe enrollment display helpers (no server imports). */

export type ContactSummary = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
}

export function contactLabel(
  contact: ContactSummary | undefined,
  fallback: string | null | undefined
) {
  if (contact?.full_name) return contact.full_name
  if (contact?.email) return contact.email
  return fallback || "Not linked"
}

const TERMINAL_ENROLLMENT_STATUSES = new Set([
  "cancelled",
  "canceled",
  "withdrawn",
  "transferred",
  "expired",
  "completed",
])

/** Enrollment statuses that are no longer “active” in registration reports. */
export function isTerminalEnrollmentStatus(status: string | null | undefined) {
  return TERMINAL_ENROLLMENT_STATUSES.has((status || "").toLowerCase())
}

export function shouldShowEnrollmentPaymentStatus(
  enrollmentStatus: string | null | undefined
) {
  return !isTerminalEnrollmentStatus(enrollmentStatus)
}

/** Charge ledger line edits are blocked once enrollment is terminal (e.g. cancelled). */
export function canEditEnrollmentCharges(
  enrollmentStatus: string | null | undefined
) {
  return !isTerminalEnrollmentStatus(enrollmentStatus)
}

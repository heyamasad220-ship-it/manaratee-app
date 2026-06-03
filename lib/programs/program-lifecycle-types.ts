export type EnrollmentStatus =
  | "pending_payment"
  | "pending"
  | "enrolled"
  | "active"
  | "completed"
  | "cancelled"
  | "withdrawn"
  | "transferred"
  | "expired"

export type WaitlistStatus =
  | "waiting"
  | "offered"
  | "accepted"
  | "declined"
  | "expired"
  | "removed"

export type LifecycleRpcResult = {
  ok: boolean
  enrollment_id?: string
  waitlist_id?: string
  status?: string
  from_status?: string
  to_status?: string
}

/** Staff forward transitions enforced by advance_enrollment_status. */
export const FORWARD_ENROLLMENT_TRANSITIONS: Record<
  EnrollmentStatus,
  EnrollmentStatus[]
> = {
  pending_payment: ["enrolled"],
  pending: ["enrolled"],
  enrolled: ["active"],
  active: ["completed"],
  completed: [],
  cancelled: [],
  withdrawn: [],
  transferred: [],
  expired: [],
}

function normalizeStatus(value: string | null | undefined) {
  return (value || "").toLowerCase()
}

export function nextForwardEnrollmentStatus(
  current: string | null | undefined
): EnrollmentStatus | null {
  const normalized = normalizeStatus(current) as EnrollmentStatus
  const options = FORWARD_ENROLLMENT_TRANSITIONS[normalized]
  return options?.[0] ?? null
}

export function canCancelEnrollmentStatus(status: string | null | undefined) {
  return ["pending_payment", "pending", "enrolled", "active"].includes(
    normalizeStatus(status)
  )
}

export function canPromoteWaitlist(
  waitlistStatus: string | null | undefined,
  program: { capacity: number; enrolled: number }
) {
  const status = normalizeStatus(waitlistStatus)
  if (!["waiting", "offered"].includes(status)) {
    return false
  }

  if (program.capacity === 0) {
    return true
  }

  return program.enrolled < program.capacity
}

export function forwardEnrollmentActionLabel(
  targetStatus: EnrollmentStatus
): string {
  switch (targetStatus) {
    case "enrolled":
      return "Confirm Enrollment"
    case "active":
      return "Mark Active"
    case "completed":
      return "Mark Completed"
    default:
      return "Advance Status"
  }
}

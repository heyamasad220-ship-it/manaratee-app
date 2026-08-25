/**
 * Universal enrollment model: applications, enrollments, payment, and roster
 * are separate. Camps and academic programs share this engine.
 */

export type EnrollmentProcess = "direct_registration" | "application_approval"
export type SeatActivationRule = "on_registration" | "after_initial_payment"

/** Enrollment statuses that appear on the operational roster. */
export const ROSTER_ENROLLMENT_STATUSES = ["enrolled", "active"] as const

/** Temporary checkout holds — not fully enrolled until seat activation. */
export const PENDING_SEAT_HOLD_STATUSES = [
  "pending",
  "pending_payment",
] as const

export const CANCELLED_ENROLLMENT_STATUSES = [
  "cancelled",
  "canceled",
  "withdrawn",
  "transferred",
  "expired",
] as const

export type DisplayEnrollmentStatus =
  | "pending"
  | "active"
  | "waitlisted"
  | "cancelled"
  | "withdrawn"
  | "completed"

export type DisplayPaymentStatus =
  | "not_required"
  | "pending"
  | "partially_paid"
  | "paid"
  | "payment_plan"
  | "balance_due"
  | "overdue"
  | "waived"
  | "refunded"

export const ENROLLMENT_PROCESS_OPTIONS: {
  id: EnrollmentProcess
  label: string
  description: string
}[] = [
  {
    id: "direct_registration",
    label: "Direct Registration",
    description: "Participants can register directly without submitting an application.",
  },
  {
    id: "application_approval",
    label: "Application & Approval",
    description:
      "Participants must submit an application and receive approval before enrollment.",
  },
]

export const SEAT_ACTIVATION_OPTIONS: {
  id: SeatActivationRule
  label: string
  description: string
  recommended?: boolean
}[] = [
  {
    id: "on_registration",
    label: "On Registration",
    description:
      "The participant becomes actively enrolled when registration is completed, even if a balance remains.",
    recommended: true,
  },
  {
    id: "after_initial_payment",
    label: "After Initial Payment",
    description:
      "The participant becomes actively enrolled only after the required initial payment is successfully completed.",
  },
]

export const DISPLAY_ENROLLMENT_STATUS_LABELS: Record<
  DisplayEnrollmentStatus,
  string
> = {
  pending: "Pending",
  active: "Active",
  waitlisted: "Waitlisted",
  cancelled: "Cancelled",
  withdrawn: "Withdrawn",
  completed: "Completed",
}

export const DISPLAY_PAYMENT_STATUS_LABELS: Record<DisplayPaymentStatus, string> =
  {
    not_required: "Not Required",
    pending: "Pending",
    partially_paid: "Partially Paid",
    paid: "Paid",
    payment_plan: "Payment Plan",
    balance_due: "Balance Due",
    overdue: "Overdue",
    waived: "Waived",
    refunded: "Refunded",
  }

export function normalizeEnrollmentProcess(
  value: string | null | undefined,
  fallbackKind?: string | null
): EnrollmentProcess {
  if (value === "direct_registration" || value === "application_approval") {
    return value
  }
  return fallbackKind === "seasonal"
    ? "direct_registration"
    : "application_approval"
}

export function normalizeSeatActivationRule(
  value: string | null | undefined
): SeatActivationRule {
  return value === "after_initial_payment"
    ? "after_initial_payment"
    : "on_registration"
}

export function isApplicationBasedProgram(program: {
  enrollment_process?: string | null
  program_kind?: string | null
} | null | undefined): boolean {
  return (
    normalizeEnrollmentProcess(
      program?.enrollment_process,
      program?.program_kind
    ) === "application_approval"
  )
}

export function normalizeEnrollmentStatusValue(
  status: string | null | undefined
) {
  return (status || "").trim().toLowerCase()
}

export function isRosterEnrollmentStatus(status: string | null | undefined) {
  const normalized = normalizeEnrollmentStatusValue(status)
  return ROSTER_ENROLLMENT_STATUSES.includes(
    normalized as (typeof ROSTER_ENROLLMENT_STATUSES)[number]
  )
}

export function isPendingSeatHoldStatus(status: string | null | undefined) {
  const normalized = normalizeEnrollmentStatusValue(status)
  return PENDING_SEAT_HOLD_STATUSES.includes(
    normalized as (typeof PENDING_SEAT_HOLD_STATUSES)[number]
  )
}

export function isCancelledEnrollmentStatus(status: string | null | undefined) {
  const normalized = normalizeEnrollmentStatusValue(status)
  return CANCELLED_ENROLLMENT_STATUSES.includes(
    normalized as (typeof CANCELLED_ENROLLMENT_STATUSES)[number]
  )
}

/** Statuses that consume a seat. Pending holds only when the program reserves checkout seats. */
export function capacityCountingEnrollmentStatuses(holdPendingSeats: boolean) {
  if (holdPendingSeats) {
    return [...ROSTER_ENROLLMENT_STATUSES, ...PENDING_SEAT_HOLD_STATUSES]
  }
  return [...ROSTER_ENROLLMENT_STATUSES]
}

export function displayEnrollmentStatus(
  status: string | null | undefined
): DisplayEnrollmentStatus {
  const normalized = normalizeEnrollmentStatusValue(status)
  if (normalized === "enrolled" || normalized === "active") return "active"
  if (normalized === "pending" || normalized === "pending_payment") {
    return "pending"
  }
  if (normalized === "waitlisted") return "waitlisted"
  if (normalized === "completed") return "completed"
  if (normalized === "withdrawn") return "withdrawn"
  return "cancelled"
}

export function displayEnrollmentStatusLabel(status: string | null | undefined) {
  return DISPLAY_ENROLLMENT_STATUS_LABELS[displayEnrollmentStatus(status)]
}

function money(value: number | null | undefined) {
  const amount = Number(value || 0)
  return Number.isFinite(amount) ? amount : 0
}

export function resolveDisplayPaymentStatus(input: {
  paymentStatus?: string | null
  paymentRequired?: boolean | null
  totalAmount?: number | null
  amountPaid?: number | null
  hasPaymentPlan?: boolean
  isOverdue?: boolean
  isRefunded?: boolean
  isWaived?: boolean
}): DisplayPaymentStatus {
  const stored = (input.paymentStatus || "").trim().toLowerCase()
  const total = money(input.totalAmount)
  const paid = money(input.amountPaid)
  const remaining = Math.max(total - paid, 0)

  if (input.isRefunded || stored === "refunded") return "refunded"
  if (input.isWaived || stored === "waived") return "waived"
  if (input.paymentRequired === false && total <= 0.009) return "not_required"
  if (stored === "paid" || remaining <= 0.009) {
    return total <= 0.009 && paid <= 0.009 ? "not_required" : "paid"
  }
  if (input.isOverdue || stored === "overdue" || stored === "past_due") {
    return "overdue"
  }
  if (input.hasPaymentPlan || stored === "payment_plan") return "payment_plan"
  if (paid > 0.009 && remaining > 0.009) {
    return stored === "partial" ? "balance_due" : "balance_due"
  }
  if (stored === "partial") return "partially_paid"
  return "pending"
}

export function displayPaymentStatusLabel(status: DisplayPaymentStatus) {
  return DISPLAY_PAYMENT_STATUS_LABELS[status]
}

export function paymentStatusBadgeClass(status: DisplayPaymentStatus) {
  switch (status) {
    case "paid":
    case "not_required":
    case "waived":
      return "bg-emerald-50 text-emerald-800"
    case "payment_plan":
      return "bg-sky-50 text-sky-800"
    case "partially_paid":
    case "balance_due":
      return "bg-amber-50 text-amber-900"
    case "overdue":
      return "bg-rose-50 text-rose-800"
    case "refunded":
      return "bg-slate-100 text-slate-700"
    default:
      return "bg-slate-50 text-slate-700"
  }
}

export function enrollmentStatusBadgeClass(status: DisplayEnrollmentStatus) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-800"
    case "pending":
      return "bg-amber-50 text-amber-900"
    case "waitlisted":
      return "bg-sky-50 text-sky-800"
    case "completed":
      return "bg-slate-100 text-slate-700"
    case "withdrawn":
    case "cancelled":
      return "bg-rose-50 text-rose-800"
    default:
      return "bg-slate-50 text-slate-700"
  }
}

/** Active on submit vs pending until first payment. */
export function enrollmentStatusForSeatActivation(
  rule: SeatActivationRule,
  paymentRequired: boolean
): "enrolled" | "pending" | "pending_payment" {
  if (rule === "after_initial_payment" && paymentRequired) {
    return "pending_payment"
  }
  if (rule === "after_initial_payment") return "pending"
  return "enrolled"
}

export function isApprovedRegistrationPending(application: {
  status?: string | null
  enrollment_id?: string | null
}) {
  return (
    (application.status || "").toLowerCase() === "approved" &&
    !application.enrollment_id
  )
}

export function customerProgramRegisterPath(programId: string) {
  return `/customer/programs/${programId}/register`
}

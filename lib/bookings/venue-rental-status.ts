import type { VenueRentalCalendarColor, VenueRentalStatus } from "./venue-rental-types"
import { VENUE_RENTAL_STATUSES } from "./venue-rental-types"

const STATUS_LABELS: Record<VenueRentalStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  awaiting_supervisor_approval: "Awaiting Supervisor Approval",
  declined: "Declined",
  approved_pending_payment: "Awaiting Payment",
  hold_expired: "Hold Expired",
  deposit_paid: "Deposit Paid",
  security_deposit_paid: "Security Deposit Paid",
  confirmed: "Confirmed",
  cancelled_before_payment: "Cancelled",
  cancelled_after_payment: "Cancelled (After Payment)",
  completed: "Completed",
  awaiting_security_deposit_refund_approval: "Awaiting Refund Approval",
  security_deposit_refunded: "Security Deposit Refunded",
  closed: "Closed",
}

/** UI color mapping from spec: green / yellow / orange */
export function getVenueRentalCalendarColor(
  status: VenueRentalStatus
): VenueRentalCalendarColor {
  switch (status) {
    case VENUE_RENTAL_STATUSES.confirmed:
    case VENUE_RENTAL_STATUSES.completed:
    case VENUE_RENTAL_STATUSES.closed:
    case VENUE_RENTAL_STATUSES.securityDepositRefunded:
      return "green"

    case VENUE_RENTAL_STATUSES.declined:
    case VENUE_RENTAL_STATUSES.holdExpired:
    case VENUE_RENTAL_STATUSES.cancelledBeforePayment:
    case VENUE_RENTAL_STATUSES.cancelledAfterPayment:
      return "orange"

    default:
      return "yellow"
  }
}

export function getVenueRentalStatusLabel(status: VenueRentalStatus): string {
  return STATUS_LABELS[status] ?? status
}

export function isVenueRentalAwaitingAction(status: VenueRentalStatus): boolean {
  return (
    status === VENUE_RENTAL_STATUSES.awaitingSupervisorApproval ||
    status === VENUE_RENTAL_STATUSES.approvedPendingPayment ||
    status === VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval
  )
}

export function isVenueRentalTerminal(status: VenueRentalStatus): boolean {
  return (
    status === VENUE_RENTAL_STATUSES.declined ||
    status === VENUE_RENTAL_STATUSES.holdExpired ||
    status === VENUE_RENTAL_STATUSES.cancelledBeforePayment ||
    status === VENUE_RENTAL_STATUSES.cancelledAfterPayment ||
    status === VENUE_RENTAL_STATUSES.closed
  )
}

const STAFF_CANCELLABLE_STATUSES = new Set<VenueRentalStatus>([
  VENUE_RENTAL_STATUSES.awaitingSupervisorApproval,
  VENUE_RENTAL_STATUSES.approvedPendingPayment,
  VENUE_RENTAL_STATUSES.depositPaid,
  VENUE_RENTAL_STATUSES.securityDepositPaid,
  VENUE_RENTAL_STATUSES.confirmed,
])

/** Active rentals staff may cancel from the rental detail page. */
export function canStaffCancelVenueRental(status: VenueRentalStatus): boolean {
  return STAFF_CANCELLABLE_STATUSES.has(status)
}

const STAFF_FORCE_BOOK_STATUSES = new Set<VenueRentalStatus>([
  VENUE_RENTAL_STATUSES.awaitingSupervisorApproval,
  VENUE_RENTAL_STATUSES.approvedPendingPayment,
  VENUE_RENTAL_STATUSES.depositPaid,
  VENUE_RENTAL_STATUSES.securityDepositPaid,
])

export const VENUE_RENTAL_FORCE_BOOK_STATUSES: VenueRentalStatus[] = Array.from(
  STAFF_FORCE_BOOK_STATUSES
)

/** Pre-confirmation rentals staff may force-book as an operational exception. */
export function canStaffForceBookVenueRental(status: VenueRentalStatus): boolean {
  return STAFF_FORCE_BOOK_STATUSES.has(status)
}

export function summarizeOutstandingRentalPayments(input: {
  depositPaid: boolean
  securityDepositPaid: boolean
  remainingBalanceDue?: boolean
  remainingPaid?: boolean
}): {
  outstandingLabels: string[]
  requiresPaymentAcknowledgement: boolean
} {
  const outstandingLabels: string[] = []

  if (!input.depositPaid) {
    outstandingLabels.push("Deposit (non-refundable)")
  }

  if (!input.securityDepositPaid) {
    outstandingLabels.push("Security deposit (refundable)")
  }

  if (input.remainingBalanceDue && !input.remainingPaid) {
    outstandingLabels.push("Remaining balance")
  }

  return {
    outstandingLabels,
    requiresPaymentAcknowledgement: outstandingLabels.length > 0,
  }
}

/** Whether cancellation should use cancelled_after_payment vs cancelled_before_payment. */
export function shouldCancelVenueRentalAfterPayment(input: {
  status: VenueRentalStatus
  depositPaid?: boolean
  securityDepositPaid?: boolean
}): boolean {
  if (input.status === VENUE_RENTAL_STATUSES.confirmed) {
    return true
  }

  if (
    input.status === VENUE_RENTAL_STATUSES.depositPaid ||
    input.status === VENUE_RENTAL_STATUSES.securityDepositPaid
  ) {
    return true
  }

  return Boolean(input.depositPaid || input.securityDepositPaid)
}

export function bothRequiredDepositsPaid(input: {
  depositPaid: boolean
  securityDepositPaid: boolean
}): boolean {
  return input.depositPaid && input.securityDepositPaid
}

export function computeHoldExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + 72 * 60 * 60 * 1000)
}

export function isHoldExpired(holdExpiresAt: string | null | undefined, now = new Date()): boolean {
  if (!holdExpiresAt) {
    return false
  }

  return new Date(holdExpiresAt).getTime() <= now.getTime()
}

export function getVenueRentalCalendarColorClasses(color: VenueRentalCalendarColor): {
  bg: string
  text: string
  border: string
} {
  switch (color) {
    case "green":
      return {
        bg: "bg-emerald-100",
        text: "text-emerald-800",
        border: "border-emerald-200",
      }
    case "orange":
      return {
        bg: "bg-orange-100",
        text: "text-orange-800",
        border: "border-orange-200",
      }
    default:
      return {
        bg: "bg-amber-100",
        text: "text-amber-800",
        border: "border-amber-200",
      }
  }
}

/** Distinct badge colors for queue / list status chips (not calendar). */
export function getVenueRentalStatusBadgeClasses(status: VenueRentalStatus): {
  bg: string
  text: string
} {
  switch (status) {
    case VENUE_RENTAL_STATUSES.draft:
      return { bg: "bg-slate-100", text: "text-slate-700" }
    case VENUE_RENTAL_STATUSES.submitted:
      return { bg: "bg-sky-100", text: "text-sky-800" }
    case VENUE_RENTAL_STATUSES.awaitingSupervisorApproval:
      return { bg: "bg-indigo-100", text: "text-indigo-800" }
    case VENUE_RENTAL_STATUSES.approvedPendingPayment:
      return { bg: "bg-amber-100", text: "text-amber-900" }
    case VENUE_RENTAL_STATUSES.depositPaid:
      return { bg: "bg-orange-100", text: "text-orange-900" }
    case VENUE_RENTAL_STATUSES.securityDepositPaid:
      return { bg: "bg-yellow-100", text: "text-yellow-900" }
    case VENUE_RENTAL_STATUSES.confirmed:
      return { bg: "bg-emerald-100", text: "text-emerald-800" }
    case VENUE_RENTAL_STATUSES.completed:
      return { bg: "bg-green-100", text: "text-green-800" }
    case VENUE_RENTAL_STATUSES.closed:
      return { bg: "bg-teal-100", text: "text-teal-800" }
    case VENUE_RENTAL_STATUSES.declined:
      return { bg: "bg-red-100", text: "text-red-800" }
    case VENUE_RENTAL_STATUSES.holdExpired:
      return { bg: "bg-stone-200", text: "text-stone-800" }
    case VENUE_RENTAL_STATUSES.cancelledBeforePayment:
    case VENUE_RENTAL_STATUSES.cancelledAfterPayment:
      return { bg: "bg-rose-100", text: "text-rose-800" }
    case VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval:
      return { bg: "bg-violet-100", text: "text-violet-800" }
    case VENUE_RENTAL_STATUSES.securityDepositRefunded:
      return { bg: "bg-cyan-100", text: "text-cyan-800" }
    default:
      return { bg: "bg-muted", text: "text-muted-foreground" }
  }
}

/** Map resource_reservations / rental_reservation status to calendar color. */
export function getReservationStatusCalendarColor(status: string): VenueRentalCalendarColor {
  const normalized = status.trim().toLowerCase()

  if (["confirmed", "fully_paid", "completed", "closed", "scheduled", "approved"].includes(normalized)) {
    return "green"
  }

  if (
    [
      "cancelled",
      "rejected",
      "expired",
      "declined",
      "hold_expired",
      "cancelled_before_payment",
      "cancelled_after_payment",
    ].includes(normalized)
  ) {
    return "orange"
  }

  return "yellow"
}

export function getReservationStatusCalendarClasses(status: string): {
  bg: string
  text: string
  border: string
} {
  return getVenueRentalCalendarColorClasses(getReservationStatusCalendarColor(status))
}

export function shouldSendBalanceReminder(input: {
  eventStartAt: string
  remainingBalanceDue: boolean
  reminderSentAt: string | null | undefined
  now?: Date
}): boolean {
  if (!input.remainingBalanceDue || input.reminderSentAt) {
    return false
  }

  const now = input.now ?? new Date()
  const eventStart = new Date(input.eventStartAt)
  const leadMs = 7 * 24 * 60 * 60 * 1000

  return eventStart.getTime() - now.getTime() >= leadMs
}

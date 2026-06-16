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
  cancelled_before_payment: "Cancelled (Before Payment)",
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

import type { CustomerRentalFinancialContext } from "./customer-venue-rental-dtos"
import type { VenueRentalQueueRow, VenueRentalStatus } from "./venue-rental-types"
import { VENUE_RENTAL_STATUSES } from "./venue-rental-types"
import {
  getVenueRentalCalendarColorClasses,
  getVenueRentalStatusLabel,
} from "./venue-rental-status"

export type CustomerRentalNextAction = {
  label: string
  requiresAction: boolean
  actionType?: CustomerDashboardActionType
}

export type CustomerDashboardActionType =
  | "sign_agreement"
  | "pay_deposit"
  | "pay_security_deposit"
  | "pay_remaining_balance"
  | "submit_new_request"
  | "none"

export type CustomerVenueRentalSections = {
  actionRequired: VenueRentalQueueRow[]
  myRequests: VenueRentalQueueRow[]
  upcoming: VenueRentalQueueRow[]
  history: VenueRentalQueueRow[]
}

export type CustomerVenueRentalDashboardPartition = {
  active: VenueRentalQueueRow[]
  past: VenueRentalQueueRow[]
}

export type CustomerTimelineStageId =
  | "request_submitted"
  | "request_approved"
  | "agreement_signed"
  | "deposit_paid"
  | "security_deposit_paid"
  | "reservation_confirmed"
  | "event_completed"
  | "security_deposit_refunded"

export type CustomerTimelineStageState =
  | "complete"
  | "current"
  | "upcoming"
  | "skipped"
  | "cancelled"

export type CustomerTimelineStage = {
  id: CustomerTimelineStageId
  label: string
  state: CustomerTimelineStageState
  dateLabel: string | null
}

export type LegacyVenueBookingRow = {
  id: string
  event_type: string | null
  event_date: string | null
  start_time: string | null
  end_time: string | null
  status: string | null
  total_amount: number | null
  balance_due: number | null
  venueName: string | null
}

const HISTORY_STATUSES = new Set<VenueRentalStatus>([
  VENUE_RENTAL_STATUSES.completed,
  VENUE_RENTAL_STATUSES.declined,
  VENUE_RENTAL_STATUSES.cancelledBeforePayment,
  VENUE_RENTAL_STATUSES.cancelledAfterPayment,
  VENUE_RENTAL_STATUSES.securityDepositRefunded,
  VENUE_RENTAL_STATUSES.holdExpired,
  VENUE_RENTAL_STATUSES.closed,
])

function getEarliestStart(row: VenueRentalQueueRow): Date | null {
  if (!row.spaces.length) return null
  const sorted = [...row.spaces].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  )
  return new Date(sorted[0].startAt)
}

function getLatestEnd(row: VenueRentalQueueRow): Date | null {
  if (!row.spaces.length) return null
  const sorted = [...row.spaces].sort(
    (a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime()
  )
  return new Date(sorted[0].endAt)
}

function getPrimaryVenueLabel(row: VenueRentalQueueRow): string {
  if (!row.spaces.length) return "Venue TBD"
  if (row.spaces.length === 1) return row.spaces[0].venueName
  return `${row.spaces[0].venueName} +${row.spaces.length - 1} more`
}

function getAllVenueLabels(row: VenueRentalQueueRow): string {
  if (!row.spaces.length) return "Venue TBD"
  return row.spaces.map((space) => space.venueName).join(", ")
}

function getPrimaryDateLabel(row: VenueRentalQueueRow): string {
  const start = getEarliestStart(row)
  if (!start) return "Date TBD"
  return start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getPrimaryTimeLabel(row: VenueRentalQueueRow): string {
  const start = getEarliestStart(row)
  if (!start || !row.spaces[0]) return ""
  const end = new Date(row.spaces[0].endAt)
  return `${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
}

function isCancelledOrDeclined(status: VenueRentalStatus): boolean {
  return (
    status === VENUE_RENTAL_STATUSES.declined ||
    status === VENUE_RENTAL_STATUSES.cancelledBeforePayment ||
    status === VENUE_RENTAL_STATUSES.cancelledAfterPayment ||
    status === VENUE_RENTAL_STATUSES.holdExpired
  )
}

export function getCustomerFriendlyStatusLabel(status: VenueRentalStatus): string {
  switch (status) {
    case VENUE_RENTAL_STATUSES.awaitingSupervisorApproval:
    case VENUE_RENTAL_STATUSES.submitted:
      return "Request under review"
    case VENUE_RENTAL_STATUSES.approvedPendingPayment:
      return "Approved — payment required"
    case VENUE_RENTAL_STATUSES.depositPaid:
      return "Deposit paid"
    case VENUE_RENTAL_STATUSES.securityDepositPaid:
      return "Security deposit paid"
    case VENUE_RENTAL_STATUSES.confirmed:
      return "Confirmed"
    case VENUE_RENTAL_STATUSES.declined:
      return "Declined"
    case VENUE_RENTAL_STATUSES.holdExpired:
      return "Hold expired"
    case VENUE_RENTAL_STATUSES.completed:
      return "Event completed"
    case VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval:
      return "Refund processing"
    case VENUE_RENTAL_STATUSES.securityDepositRefunded:
      return "Security deposit refunded"
    case VENUE_RENTAL_STATUSES.closed:
      return "Closed"
    case VENUE_RENTAL_STATUSES.cancelledBeforePayment:
    case VENUE_RENTAL_STATUSES.cancelledAfterPayment:
      return "Cancelled"
    default:
      return getVenueRentalStatusLabel(status)
  }
}

function resolvePaymentAction(
  context: CustomerRentalFinancialContext | undefined
): CustomerRentalNextAction | null {
  if (!context) return null

  const { payments, contract } = context

  if (contract?.canSign) {
    return {
      label: "Review and sign agreement",
      requiresAction: true,
      actionType: "sign_agreement",
    }
  }

  if (payments.deposit?.isDue) {
    return {
      label: "Pay deposit",
      requiresAction: true,
      actionType: "pay_deposit",
    }
  }

  if (payments.securityDeposit?.isDue) {
    return {
      label: "Pay security deposit",
      requiresAction: true,
      actionType: "pay_security_deposit",
    }
  }

  if (payments.remainingBalance?.isDue) {
    const dueLabel = payments.remainingBalance.dueDateLabel
      ? `Pay remaining balance by ${payments.remainingBalance.dueDateLabel}`
      : "Pay remaining balance"
    return {
      label: dueLabel,
      requiresAction: true,
      actionType: "pay_remaining_balance",
    }
  }

  return null
}

export function getCustomerRentalNextAction(
  row: VenueRentalQueueRow,
  context?: CustomerRentalFinancialContext
): CustomerRentalNextAction {
  const paymentAction = resolvePaymentAction(context)
  if (paymentAction) {
    return paymentAction
  }

  const holdDeadline = row.holdExpiresAt
    ? new Date(row.holdExpiresAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null

  switch (row.status) {
    case VENUE_RENTAL_STATUSES.approvedPendingPayment:
      return {
        label: holdDeadline
          ? `Complete payment by ${holdDeadline}`
          : "Complete deposit and security deposit payment",
        requiresAction: true,
        actionType: "pay_deposit",
      }
    case VENUE_RENTAL_STATUSES.depositPaid:
      return {
        label: "Pay security deposit to confirm your rental",
        requiresAction: true,
        actionType: "pay_security_deposit",
      }
    case VENUE_RENTAL_STATUSES.declined:
    case VENUE_RENTAL_STATUSES.holdExpired:
    case VENUE_RENTAL_STATUSES.cancelledBeforePayment:
      return {
        label: "Submit a new request",
        requiresAction: true,
        actionType: "submit_new_request",
      }
    case VENUE_RENTAL_STATUSES.awaitingSupervisorApproval:
    case VENUE_RENTAL_STATUSES.submitted:
    case VENUE_RENTAL_STATUSES.draft:
      return {
        label: "No action required — we're reviewing your request",
        requiresAction: false,
        actionType: "none",
      }
    case VENUE_RENTAL_STATUSES.confirmed:
      return {
        label: "No action required — your rental is confirmed",
        requiresAction: false,
        actionType: "none",
      }
    case VENUE_RENTAL_STATUSES.securityDepositPaid:
      return {
        label: "No action required — final confirmation in progress",
        requiresAction: false,
        actionType: "none",
      }
    case VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval:
      return {
        label: "Security deposit refund in progress",
        requiresAction: false,
        actionType: "none",
      }
    case VENUE_RENTAL_STATUSES.completed:
    case VENUE_RENTAL_STATUSES.securityDepositRefunded:
    case VENUE_RENTAL_STATUSES.closed:
      return {
        label: "No action required — rental complete",
        requiresAction: false,
        actionType: "none",
      }
    case VENUE_RENTAL_STATUSES.cancelledAfterPayment:
      return {
        label: "No action required",
        requiresAction: false,
        actionType: "none",
      }
    default:
      return {
        label: getCustomerFriendlyStatusLabel(row.status),
        requiresAction: false,
        actionType: "none",
      }
  }
}

export function getCustomerDashboardActionLabel(
  row: VenueRentalQueueRow,
  context?: CustomerRentalFinancialContext
): string {
  const nextAction = getCustomerRentalNextAction(row, context)

  switch (nextAction.actionType) {
    case "sign_agreement":
      return "Sign agreement"
    case "pay_deposit":
      return "Pay deposit"
    case "pay_security_deposit":
      return "Pay security deposit"
    case "pay_remaining_balance":
      return "Pay remaining balance"
    case "submit_new_request":
      return "Submit new request"
    default:
      return nextAction.label
  }
}

export function isCustomerHistoryStatus(status: VenueRentalStatus): boolean {
  return HISTORY_STATUSES.has(status)
}

export function getCustomerRentalStatusHeadline(
  row: VenueRentalQueueRow,
  context?: CustomerRentalFinancialContext
): string {
  const nextAction = getCustomerRentalNextAction(row, context)

  switch (nextAction.actionType) {
    case "sign_agreement":
      return "Agreement ready"
    case "pay_deposit":
      return "Deposit required"
    case "pay_security_deposit":
      return "Security deposit required"
    case "pay_remaining_balance":
      return "Balance due"
    case "submit_new_request":
      return getCustomerFriendlyStatusLabel(row.status)
  }

  switch (row.status) {
    case VENUE_RENTAL_STATUSES.awaitingSupervisorApproval:
    case VENUE_RENTAL_STATUSES.submitted:
    case VENUE_RENTAL_STATUSES.draft:
      return "Request under review"
    case VENUE_RENTAL_STATUSES.confirmed:
      return "Confirmed"
    case VENUE_RENTAL_STATUSES.completed:
      return "Event completed"
    case VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval:
      return "Refund processing"
    case VENUE_RENTAL_STATUSES.securityDepositRefunded:
      return "Refunded"
    default:
      return getCustomerFriendlyStatusLabel(row.status)
  }
}

export function getCustomerRentalNextStepLabel(
  row: VenueRentalQueueRow,
  context?: CustomerRentalFinancialContext
): string {
  const nextAction = getCustomerRentalNextAction(row, context)

  if (!nextAction.requiresAction) {
    if (row.status === VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval) {
      return "Refund in progress"
    }
    return "No action required"
  }

  switch (nextAction.actionType) {
    case "sign_agreement":
      return "Review agreement"
    case "pay_deposit":
      return "Pay deposit"
    case "pay_security_deposit":
      return "Pay security deposit"
    case "pay_remaining_balance":
      return "Pay remaining balance"
    case "submit_new_request":
      return "Submit new request"
    default:
      return getCustomerDashboardActionLabel(row, context)
  }
}

function sortActiveRentals(
  rows: VenueRentalQueueRow[],
  contexts?: Map<string, CustomerRentalFinancialContext>
): VenueRentalQueueRow[] {
  return [...rows].sort((a, b) => {
    const aNeedsAction = getCustomerRentalNextAction(
      a,
      contexts?.get(a.id)
    ).requiresAction
      ? 0
      : 1
    const bNeedsAction = getCustomerRentalNextAction(
      b,
      contexts?.get(b.id)
    ).requiresAction
      ? 0
      : 1

    if (aNeedsAction !== bNeedsAction) {
      return aNeedsAction - bNeedsAction
    }

    const aDate = getEarliestStart(a)?.getTime() ?? Number.POSITIVE_INFINITY
    const bDate = getEarliestStart(b)?.getTime() ?? Number.POSITIVE_INFINITY

    return aDate - bDate
  })
}

export function partitionCustomerVenueRentalsForDashboard(
  rows: VenueRentalQueueRow[],
  contexts?: Map<string, CustomerRentalFinancialContext>
): CustomerVenueRentalDashboardPartition {
  const sections = partitionCustomerVenueRentals(rows, contexts)
  const active = sortActiveRentals(
    [
      ...sections.actionRequired,
      ...sections.myRequests,
      ...sections.upcoming,
    ],
    contexts
  )

  const past = [...sections.history].sort((a, b) => {
    const aDate = getEarliestStart(a)?.getTime() ?? 0
    const bDate = getEarliestStart(b)?.getTime() ?? 0
    return bDate - aDate
  })

  return { active, past }
}

export function partitionCustomerVenueRentals(
  rows: VenueRentalQueueRow[],
  contexts?: Map<string, CustomerRentalFinancialContext>
): CustomerVenueRentalSections {
  const now = new Date()
  const actionRequired: VenueRentalQueueRow[] = []
  const myRequests: VenueRentalQueueRow[] = []
  const upcoming: VenueRentalQueueRow[] = []
  const history: VenueRentalQueueRow[] = []

  for (const row of rows) {
    const context = contexts?.get(row.id)
    const nextAction = getCustomerRentalNextAction(row, context)
    const earliest = getEarliestStart(row)
    const isUpcoming =
      row.status === VENUE_RENTAL_STATUSES.confirmed &&
      earliest !== null &&
      earliest.getTime() >= now.getTime()

    if (isUpcoming) {
      upcoming.push(row)
      continue
    }

    if (isCustomerHistoryStatus(row.status)) {
      history.push(row)
      continue
    }

    if (nextAction.requiresAction) {
      actionRequired.push(row)
      continue
    }

    myRequests.push(row)
  }

  return { actionRequired, myRequests, upcoming, history }
}

type TimelineInput = {
  rental: VenueRentalQueueRow
  approvedAt: string | null
  context: CustomerRentalFinancialContext
}

function stageState(
  complete: boolean,
  current: boolean,
  cancelled: boolean
): CustomerTimelineStageState {
  if (cancelled && !complete) return "cancelled"
  if (complete) return "complete"
  if (current) return "current"
  return "upcoming"
}

export function getCustomerRentalTimelineStages(input: TimelineInput): CustomerTimelineStage[] {
  const { rental, approvedAt, context } = input
  const { payments, contract } = context
  const cancelled = isCancelledOrDeclined(rental.status)

  const submittedComplete = rental.status !== VENUE_RENTAL_STATUSES.draft
  const approvedComplete =
    approvedAt !== null ||
    rental.status === VENUE_RENTAL_STATUSES.approvedPendingPayment ||
    rental.status === VENUE_RENTAL_STATUSES.depositPaid ||
    rental.status === VENUE_RENTAL_STATUSES.securityDepositPaid ||
    rental.status === VENUE_RENTAL_STATUSES.confirmed ||
    rental.status === VENUE_RENTAL_STATUSES.completed ||
    rental.status === VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval ||
    rental.status === VENUE_RENTAL_STATUSES.securityDepositRefunded ||
    rental.status === VENUE_RENTAL_STATUSES.closed

  const agreementSigned = contract?.status === "Signed"
  const depositPaid = payments.deposit?.isPaid ?? false
  const securityPaid = payments.securityDeposit?.isPaid ?? false
  const confirmed =
    rental.status === VENUE_RENTAL_STATUSES.confirmed ||
    rental.status === VENUE_RENTAL_STATUSES.completed ||
    rental.status === VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval ||
    rental.status === VENUE_RENTAL_STATUSES.securityDepositRefunded ||
    rental.status === VENUE_RENTAL_STATUSES.closed

  const eventEnd = getLatestEnd(rental)
  const eventCompleted =
    rental.status === VENUE_RENTAL_STATUSES.completed ||
    rental.status === VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval ||
    rental.status === VENUE_RENTAL_STATUSES.securityDepositRefunded ||
    rental.status === VENUE_RENTAL_STATUSES.closed ||
    (eventEnd !== null && eventEnd.getTime() < Date.now() && confirmed)

  const refundComplete =
    rental.status === VENUE_RENTAL_STATUSES.securityDepositRefunded ||
    payments.refundStatus === "refunded"

  const milestones: Array<{
    id: CustomerTimelineStageId
    label: string
    complete: boolean
    dateLabel: string | null
  }> = [
    {
      id: "request_submitted",
      label: "Request submitted",
      complete: submittedComplete,
      dateLabel: rental.submittedAtLabel,
    },
    {
      id: "request_approved",
      label: "Request approved",
      complete: approvedComplete && !cancelled,
      dateLabel: approvedAt
        ? new Date(approvedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : null,
    },
    {
      id: "agreement_signed",
      label: "Agreement signed",
      complete: agreementSigned,
      dateLabel: contract?.signedAt
        ? new Date(contract.signedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : null,
    },
    {
      id: "deposit_paid",
      label: "Deposit paid",
      complete: depositPaid,
      dateLabel: payments.deposit?.paidDateLabel ?? null,
    },
    {
      id: "security_deposit_paid",
      label: "Security deposit paid",
      complete: securityPaid,
      dateLabel: payments.securityDeposit?.paidDateLabel ?? null,
    },
    {
      id: "reservation_confirmed",
      label: "Reservation confirmed",
      complete: confirmed,
      dateLabel: confirmed ? getPrimaryDateLabel(rental) : null,
    },
    {
      id: "event_completed",
      label: "Event completed",
      complete: eventCompleted,
      dateLabel: eventCompleted && eventEnd
        ? eventEnd.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : null,
    },
    {
      id: "security_deposit_refunded",
      label: "Security deposit refunded",
      complete: refundComplete,
      dateLabel:
        payments.refundStatus === "refunded" ? payments.refundLabel : null,
    },
  ]

  const firstIncompleteIndex = milestones.findIndex((stage) => !stage.complete)

  return milestones.map((stage, index) => {
    const isCurrent =
      !cancelled &&
      firstIncompleteIndex === index &&
      !stage.complete

    return {
      id: stage.id,
      label: stage.label,
      dateLabel: stage.dateLabel,
      state: stageState(stage.complete, isCurrent, cancelled),
    }
  })
}

export function getCustomerRentalCardSummary(
  row: VenueRentalQueueRow,
  context?: CustomerRentalFinancialContext
) {
  const colors = getVenueRentalCalendarColorClasses(row.calendarColor)
  return {
    venueLabel: getPrimaryVenueLabel(row),
    venueLabels: getAllVenueLabels(row),
    dateLabel: getPrimaryDateLabel(row),
    timeLabel: getPrimaryTimeLabel(row),
    statusLabel: getCustomerFriendlyStatusLabel(row.status),
    nextAction: getCustomerRentalNextAction(row, context),
    dashboardActionLabel: getCustomerDashboardActionLabel(row, context),
    colors,
  }
}

export {
  getEarliestStart,
  getLatestEnd,
  getPrimaryVenueLabel,
  getAllVenueLabels,
  getPrimaryDateLabel,
  getPrimaryTimeLabel,
}

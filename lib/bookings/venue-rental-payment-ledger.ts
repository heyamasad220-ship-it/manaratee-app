import {
  RENTAL_PAYMENT_METHODS,
  RENTAL_PAYMENT_STATUSES,
  RENTAL_PAYMENT_TYPES,
  VENUE_RENTAL_STATUSES,
  type RentalPaymentMethod,
  type RentalPaymentRecord,
  type RentalPaymentStatus,
  type RentalPaymentType,
  type VenueRentalStatus,
} from "@/lib/bookings/venue-rental-types"

/** Derived payment-status badges for the Venue Rentals Payments ledger. */
export type VenueRentalPaymentLedgerStatus =
  | "no_charges"
  | "complimentary"
  | "unpaid"
  | "partial"
  | "paid"
  | "overdue"
  | "refund_due"
  | "refunded"

/** Saved views / status filters on the Payments page. */
export type VenueRentalPaymentLedgerView =
  | "financial"
  | "unpaid"
  | "partial"
  | "paid"
  | "overdue"
  | "refunds"
  | "no_charges"
  | "all"

export type VenueRentalPaymentMethodFilter =
  | "all"
  | "manual"
  | "online"
  | RentalPaymentMethod

export type VenueRentalPaymentLedgerSortKey =
  | "event_date"
  | "total_charges"
  | "received"
  | "balance_due"
  | "due_date"
  | "customer"

export type VenueRentalStaffNextActionKey =
  | "add_charges"
  | "collect_payment"
  | "collect_remaining"
  | "send_reminder"
  | "review_overdue"
  | "process_refund"
  | "view_history"
  | "none"

export type VenueRentalStaffNextAction = {
  key: VenueRentalStaffNextActionKey
  label: string
  /** Relative path when the action can navigate (usually rental financial tab). */
  href: string | null
}

export type VenueRentalPaymentLedgerSummary = {
  totalCharges: number
  amountReceived: number
  refundedAmount: number
  appliedCredits: number
  balanceDue: number
  unappliedCredit: number
  refundableSecurity: number
  depositAmount: number
  depositReceived: number
  securityAmount: number
  securityReceived: number
  remainingAmount: number
  remainingReceived: number
  remainingDue: number
  rentalFeeAmount: number
  cleaningFeeAmount: number
  addonFeeAmount: number
  discountAmount: number
  adjustmentAmount: number
  paymentDueAt: string | null
  hasOnlinePayment: boolean
  hasManualPayment: boolean
  unpaidPaymentIds: {
    depositId: string | null
    securityId: string | null
    remainingId: string | null
  }
}

export type VenueRentalChargeBreakdown = {
  rentalFee: number
  securityDeposit: number
  cleaningFee: number
  addonFees: number
  discounts: number
  adjustments: number
  totalCharges: number
}

const CHARGE_TYPES = new Set<string>([
  RENTAL_PAYMENT_TYPES.deposit,
  RENTAL_PAYMENT_TYPES.securityDeposit,
  RENTAL_PAYMENT_TYPES.remainingBalance,
  RENTAL_PAYMENT_TYPES.addonFee,
  RENTAL_PAYMENT_TYPES.installment,
  RENTAL_PAYMENT_TYPES.cleaningFee,
  RENTAL_PAYMENT_TYPES.adjustment,
])

export function isInactiveLedgerStatus(status: string) {
  return (
    status === RENTAL_PAYMENT_STATUSES.voided ||
    status === RENTAL_PAYMENT_STATUSES.failed
  )
}

export function isCompletedPaymentStatus(status: string) {
  return (
    status === RENTAL_PAYMENT_STATUSES.paidManually ||
    status === RENTAL_PAYMENT_STATUSES.paidStripeLater ||
    status === RENTAL_PAYMENT_STATUSES.completed
  )
}

export function isPendingPaymentStatus(status: string) {
  return (
    status === RENTAL_PAYMENT_STATUSES.unpaid ||
    status === RENTAL_PAYMENT_STATUSES.paymentRequested ||
    status === RENTAL_PAYMENT_STATUSES.pending
  )
}

export function transactionStatusLabel(status: string): string {
  switch (status) {
    case RENTAL_PAYMENT_STATUSES.unpaid:
    case RENTAL_PAYMENT_STATUSES.paymentRequested:
    case RENTAL_PAYMENT_STATUSES.pending:
      return "Pending"
    case RENTAL_PAYMENT_STATUSES.paidManually:
    case RENTAL_PAYMENT_STATUSES.paidStripeLater:
    case RENTAL_PAYMENT_STATUSES.completed:
      return "Completed"
    case RENTAL_PAYMENT_STATUSES.failed:
      return "Failed"
    case RENTAL_PAYMENT_STATUSES.voided:
      return "Voided"
    case RENTAL_PAYMENT_STATUSES.refunded:
      return "Refunded"
    case RENTAL_PAYMENT_STATUSES.partiallyRefunded:
      return "Partially Refunded"
    default:
      return status.replace(/_/g, " ")
  }
}

export function paymentMethodLabel(method: string | null | undefined): string {
  switch (method) {
    case RENTAL_PAYMENT_METHODS.cash:
      return "Cash"
    case RENTAL_PAYMENT_METHODS.check:
      return "Check"
    case RENTAL_PAYMENT_METHODS.ach:
      return "ACH"
    case RENTAL_PAYMENT_METHODS.cardTerminal:
      return "Card terminal"
    case RENTAL_PAYMENT_METHODS.online:
      return "Online"
    case RENTAL_PAYMENT_METHODS.other:
      return "Other"
    default:
      return "—"
  }
}

export function paymentTypeHistoryLabel(type: RentalPaymentType | string): string {
  switch (type) {
    case RENTAL_PAYMENT_TYPES.deposit:
      return "Deposit"
    case RENTAL_PAYMENT_TYPES.installment:
      return "Installment"
    case RENTAL_PAYMENT_TYPES.remainingBalance:
      return "Final Payment"
    case RENTAL_PAYMENT_TYPES.addonFee:
      return "Equipment / Add-on"
    case RENTAL_PAYMENT_TYPES.securityDeposit:
      return "Security Deposit"
    case RENTAL_PAYMENT_TYPES.cleaningFee:
      return "Cleaning Fee"
    case RENTAL_PAYMENT_TYPES.refund:
      return "Refund"
    case RENTAL_PAYMENT_TYPES.credit:
      return "Credit"
    case RENTAL_PAYMENT_TYPES.adjustment:
      return "Adjustment"
    case RENTAL_PAYMENT_TYPES.discount:
      return "Discount"
    default:
      return String(type).replace(/_/g, " ")
  }
}

export function summarizeVenueRentalPaymentLedger(
  payments: RentalPaymentRecord[]
): VenueRentalPaymentLedgerSummary {
  let depositAmount = 0
  let depositReceived = 0
  let securityAmount = 0
  let securityReceived = 0
  let remainingAmount = 0
  let remainingReceived = 0
  let rentalFeeAmount = 0
  let cleaningFeeAmount = 0
  let addonFeeAmount = 0
  let discountAmount = 0
  let adjustmentAmount = 0
  let refundedAmount = 0
  let appliedCredits = 0
  let amountReceived = 0
  let unpaidDepositId: string | null = null
  let unpaidSecurityId: string | null = null
  let unpaidRemainingId: string | null = null
  let paymentDueAt: string | null = null
  let hasOnlinePayment = false
  let hasManualPayment = false

  for (const payment of payments) {
    if (isInactiveLedgerStatus(payment.status)) continue

    const amount = Number(payment.amount) || 0
    const completed = isCompletedPaymentStatus(payment.status)

    if (payment.payment_type === RENTAL_PAYMENT_TYPES.refund) {
      if (
        payment.status === RENTAL_PAYMENT_STATUSES.refunded ||
        completed
      ) {
        refundedAmount += amount
      }
      continue
    }

    if (payment.payment_type === RENTAL_PAYMENT_TYPES.credit) {
      if (completed || payment.status === RENTAL_PAYMENT_STATUSES.refunded) {
        appliedCredits += amount
      }
      continue
    }

    if (payment.payment_type === RENTAL_PAYMENT_TYPES.discount) {
      discountAmount += amount
      appliedCredits += amount
      continue
    }

    if (completed) {
      amountReceived += amount
      if (
        payment.status === RENTAL_PAYMENT_STATUSES.paidStripeLater ||
        payment.payment_method === RENTAL_PAYMENT_METHODS.online
      ) {
        hasOnlinePayment = true
      }
      if (
        payment.status === RENTAL_PAYMENT_STATUSES.paidManually ||
        (payment.payment_method &&
          payment.payment_method !== RENTAL_PAYMENT_METHODS.online)
      ) {
        hasManualPayment = true
      }
    } else if (isPendingPaymentStatus(payment.status) && payment.due_at) {
      if (!paymentDueAt || new Date(payment.due_at) < new Date(paymentDueAt)) {
        paymentDueAt = payment.due_at
      }
    }

    if (payment.payment_type === RENTAL_PAYMENT_TYPES.deposit) {
      depositAmount += amount
      rentalFeeAmount += amount
      if (completed) depositReceived += amount
      else if (!unpaidDepositId) unpaidDepositId = payment.id
    } else if (payment.payment_type === RENTAL_PAYMENT_TYPES.securityDeposit) {
      securityAmount += amount
      if (completed) securityReceived += amount
      else if (!unpaidSecurityId) unpaidSecurityId = payment.id
    } else if (
      payment.payment_type === RENTAL_PAYMENT_TYPES.remainingBalance ||
      payment.payment_type === RENTAL_PAYMENT_TYPES.installment
    ) {
      remainingAmount += amount
      rentalFeeAmount += amount
      if (completed) remainingReceived += amount
      else if (
        payment.payment_type === RENTAL_PAYMENT_TYPES.remainingBalance &&
        !unpaidRemainingId
      ) {
        unpaidRemainingId = payment.id
      }
    } else if (payment.payment_type === RENTAL_PAYMENT_TYPES.cleaningFee) {
      cleaningFeeAmount += amount
    } else if (payment.payment_type === RENTAL_PAYMENT_TYPES.addonFee) {
      addonFeeAmount += amount
    } else if (payment.payment_type === RENTAL_PAYMENT_TYPES.adjustment) {
      adjustmentAmount += amount
    }
  }

  const totalCharges =
    depositAmount +
    securityAmount +
    remainingAmount +
    cleaningFeeAmount +
    addonFeeAmount +
    adjustmentAmount
  const balanceDue = Math.max(0, totalCharges - amountReceived - appliedCredits)
  const unappliedCredit = Math.max(0, amountReceived + appliedCredits - totalCharges)
  const refundableSecurity = Math.max(0, securityReceived - refundedAmount)
  const remainingDue = Math.max(0, remainingAmount - remainingReceived)

  return {
    totalCharges,
    amountReceived,
    refundedAmount,
    appliedCredits,
    balanceDue,
    unappliedCredit,
    refundableSecurity,
    depositAmount,
    depositReceived,
    securityAmount,
    securityReceived,
    remainingAmount,
    remainingReceived,
    remainingDue,
    rentalFeeAmount,
    cleaningFeeAmount,
    addonFeeAmount,
    discountAmount,
    adjustmentAmount,
    paymentDueAt,
    hasOnlinePayment,
    hasManualPayment,
    unpaidPaymentIds: {
      depositId: unpaidDepositId,
      securityId: unpaidSecurityId,
      remainingId: unpaidRemainingId,
    },
  }
}

export function buildVenueRentalChargeBreakdown(
  summary: VenueRentalPaymentLedgerSummary
): VenueRentalChargeBreakdown {
  return {
    rentalFee: summary.rentalFeeAmount,
    securityDeposit: summary.securityAmount,
    cleaningFee: summary.cleaningFeeAmount,
    addonFees: summary.addonFeeAmount,
    discounts: summary.discountAmount,
    adjustments: summary.adjustmentAmount,
    totalCharges: summary.totalCharges,
  }
}

export function deriveVenueRentalPaymentLedgerStatus(input: {
  rentalStatus: VenueRentalStatus
  totalCharges: number
  amountReceived: number
  balanceDue: number
  unappliedCredit: number
  refundableSecurity: number
  refundedAmount: number
  paymentDueAt: string | null
  now?: Date
}): VenueRentalPaymentLedgerStatus {
  const now = input.now ?? new Date()
  const {
    rentalStatus,
    totalCharges,
    amountReceived,
    balanceDue,
    unappliedCredit,
    refundableSecurity,
    refundedAmount,
    paymentDueAt,
  } = input

  const refundWorkflowComplete =
    rentalStatus === VENUE_RENTAL_STATUSES.securityDepositRefunded ||
    (refundedAmount > 0 &&
      refundableSecurity <= 0 &&
      balanceDue <= 0 &&
      (rentalStatus === VENUE_RENTAL_STATUSES.completed ||
        rentalStatus === VENUE_RENTAL_STATUSES.closed ||
        rentalStatus === VENUE_RENTAL_STATUSES.cancelledAfterPayment))

  if (refundWorkflowComplete) {
    return "refunded"
  }

  const refundDue =
    rentalStatus === VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval ||
    unappliedCredit > 0 ||
    (refundableSecurity > 0 &&
      (rentalStatus === VENUE_RENTAL_STATUSES.completed ||
        rentalStatus === VENUE_RENTAL_STATUSES.closed ||
        rentalStatus === VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval))

  if (refundDue) {
    return "refund_due"
  }

  if (totalCharges <= 0) {
    // Never auto-label Complimentary — staff set that manually later if needed.
    return "no_charges"
  }

  if (balanceDue <= 0) {
    return "paid"
  }

  const duePassed =
    Boolean(paymentDueAt) && new Date(paymentDueAt as string).getTime() < now.getTime()

  if (duePassed) {
    return "overdue"
  }

  if (amountReceived > 0) {
    return "partial"
  }

  return "unpaid"
}

export function venueRentalPaymentLedgerStatusLabel(
  status: VenueRentalPaymentLedgerStatus
): string {
  switch (status) {
    case "no_charges":
      return "No Charges"
    case "complimentary":
      return "Complimentary"
    case "unpaid":
      return "Unpaid"
    case "partial":
      return "Partial"
    case "paid":
      return "Paid"
    case "overdue":
      return "Overdue"
    case "refund_due":
      return "Refund Due"
    case "refunded":
      return "Refunded"
    default:
      return status
  }
}

export function venueRentalFinancialHref(
  rentalId: string,
  action?: string | null
): string {
  const params = new URLSearchParams()
  params.set("tab", "financial")
  params.set("from", "payments")
  if (action) params.set("action", action)
  return `/bookings/rentals/${rentalId}?${params.toString()}`
}

export function deriveVenueRentalStaffNextAction(input: {
  rentalId: string
  paymentStatus: VenueRentalPaymentLedgerStatus
  balanceDue: number
}): VenueRentalStaffNextAction {
  const { rentalId, paymentStatus } = input

  if (paymentStatus === "no_charges") {
    return {
      key: "add_charges",
      label: "Add Charges",
      href: venueRentalFinancialHref(rentalId, "add_charge"),
    }
  }

  if (paymentStatus === "refund_due") {
    return {
      key: "process_refund",
      label: "Process Refund",
      href: venueRentalFinancialHref(rentalId, "refund"),
    }
  }

  if (paymentStatus === "overdue") {
    return {
      key: "review_overdue",
      label: "Review Overdue Balance",
      href: venueRentalFinancialHref(rentalId, "reminder"),
    }
  }

  if (paymentStatus === "unpaid") {
    return {
      key: "collect_payment",
      label: "Collect Payment",
      href: venueRentalFinancialHref(rentalId, "record_payment"),
    }
  }

  if (paymentStatus === "partial") {
    return {
      key: "collect_remaining",
      label: "Collect Remaining Balance",
      href: venueRentalFinancialHref(rentalId, "record_payment"),
    }
  }

  if (paymentStatus === "paid" || paymentStatus === "complimentary") {
    return {
      key: "none",
      label: "No Action Needed",
      href: null,
    }
  }

  if (paymentStatus === "refunded") {
    return {
      key: "view_history",
      label: "View Payment History",
      href: venueRentalFinancialHref(rentalId),
    }
  }

  return {
    key: "view_history",
    label: "View Payment History",
    href: venueRentalFinancialHref(rentalId),
  }
}

export function rentalHasFinancialActivity(input: {
  totalCharges: number
  amountReceived: number
  refundedAmount: number
  balanceDue: number
  paymentStatus: VenueRentalPaymentLedgerStatus
  paymentCount: number
}): boolean {
  if (input.paymentCount > 0) return true
  if (input.totalCharges > 0) return true
  if (input.amountReceived > 0) return true
  if (input.refundedAmount > 0) return true
  if (input.balanceDue > 0) return true
  if (
    input.paymentStatus === "refund_due" ||
    input.paymentStatus === "refunded" ||
    input.paymentStatus === "complimentary"
  ) {
    return true
  }
  return false
}

export function matchesVenueRentalPaymentLedgerView(
  view: VenueRentalPaymentLedgerView,
  paymentStatus: VenueRentalPaymentLedgerStatus,
  options?: { includeNoCharges?: boolean; hasFinancialActivity?: boolean }
): boolean {
  switch (view) {
    case "all":
      return true
    case "financial":
      if (paymentStatus === "no_charges") {
        return Boolean(options?.includeNoCharges)
      }
      return options?.hasFinancialActivity !== false
    case "unpaid":
      return paymentStatus === "unpaid"
    case "partial":
      return paymentStatus === "partial"
    case "paid":
      return paymentStatus === "paid" || paymentStatus === "complimentary"
    case "overdue":
      return paymentStatus === "overdue"
    case "refunds":
      return paymentStatus === "refund_due" || paymentStatus === "refunded"
    case "no_charges":
      return paymentStatus === "no_charges"
    default:
      return true
  }
}

export function isChargeLedgerType(type: string) {
  return CHARGE_TYPES.has(type)
}

export function canEditPendingCharge(status: RentalPaymentStatus | string) {
  return isPendingPaymentStatus(status)
}

export function canVoidCompletedPayment(status: RentalPaymentStatus | string) {
  return isCompletedPaymentStatus(status)
}

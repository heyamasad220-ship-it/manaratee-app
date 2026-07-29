export const VENUE_RENTAL_STATUSES = {
  draft: "draft",
  submitted: "submitted",
  /** Admin waiting for more information from the customer before approving. */
  pending: "pending",
  /** @deprecated Prefer `submitted` / `pending`. Kept for legacy rows. */
  awaitingSupervisorApproval: "awaiting_supervisor_approval",
  declined: "declined",
  approvedPendingPayment: "approved_pending_payment",
  holdExpired: "hold_expired",
  /** @deprecated Deposit paid now maps to `confirmed`. Kept for legacy rows. */
  depositPaid: "deposit_paid",
  /** @deprecated Security deposit is not required for confirmation. */
  securityDepositPaid: "security_deposit_paid",
  confirmed: "confirmed",
  cancelledBeforePayment: "cancelled_before_payment",
  cancelledAfterPayment: "cancelled_after_payment",
  completed: "completed",
  awaitingSecurityDepositRefundApproval: "awaiting_security_deposit_refund_approval",
  securityDepositRefunded: "security_deposit_refunded",
  closed: "closed",
} as const

export type VenueRentalStatus =
  (typeof VENUE_RENTAL_STATUSES)[keyof typeof VENUE_RENTAL_STATUSES]

export const RENTAL_RESERVATION_STATUSES = {
  temporaryHold: "temporary_hold",
  confirmed: "confirmed",
  cancelled: "cancelled",
  expired: "expired",
  blocked: "blocked",
} as const

export type RentalReservationStatus =
  (typeof RENTAL_RESERVATION_STATUSES)[keyof typeof RENTAL_RESERVATION_STATUSES]

export const RENTAL_PAYMENT_TYPES = {
  deposit: "deposit",
  securityDeposit: "security_deposit",
  remainingBalance: "remaining_balance",
  addonFee: "addon_fee",
  refund: "refund",
} as const

export type RentalPaymentType =
  (typeof RENTAL_PAYMENT_TYPES)[keyof typeof RENTAL_PAYMENT_TYPES]

export const RENTAL_PAYMENT_STATUSES = {
  unpaid: "unpaid",
  paymentRequested: "payment_requested",
  paidManually: "paid_manually",
  paidStripeLater: "paid_stripe_later",
  refunded: "refunded",
} as const

export type RentalPaymentStatus =
  (typeof RENTAL_PAYMENT_STATUSES)[keyof typeof RENTAL_PAYMENT_STATUSES]

export const RENTAL_CONTRACT_STATUSES = {
  generated: "generated",
  sent: "sent",
  signed: "signed",
  voided: "voided",
} as const

export type RentalContractStatus =
  (typeof RENTAL_CONTRACT_STATUSES)[keyof typeof RENTAL_CONTRACT_STATUSES]

export type VenueRentalCalendarColor = "green" | "yellow" | "orange"

export interface VenueRentalRecord {
  id: string
  organization_id: string
  customer_user_id: string | null
  billing_contact_id: string | null
  venue_rental_event_type_id: string | null
  status: VenueRentalStatus
  notes: string | null
  expected_attendance: number | null
  supervisor_user_id: string | null
  approved_at: string | null
  declined_at: string | null
  decline_reason: string | null
  hold_expires_at: string | null
  payment_notice_sent_at: string | null
  event_reminder_sent_at: string | null
  inspection_completed_at: string | null
  closed_at: string | null
  legacy_venue_booking_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface RentalReservationRecord {
  id: string
  organization_id: string
  venue_rental_id: string
  venue_id: string
  start_at: string
  end_at: string
  /** Buffer before event start — occupied window on shared calendar. */
  setup_minutes?: number
  /** Buffer after event end — occupied window on shared calendar. */
  cleanup_minutes?: number
  status: RentalReservationStatus
  hold_expires_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface RentalPaymentRecord {
  id: string
  organization_id: string
  venue_rental_id: string
  payment_type: RentalPaymentType
  status: RentalPaymentStatus
  amount: number
  currency: string
  due_at: string | null
  paid_at: string | null
  notes: string | null
  stripe_payment_intent_id: string | null
  created_at: string
  updated_at: string
}

export interface RentalContractRecord {
  id: string
  organization_id: string
  venue_rental_id: string
  status: RentalContractStatus
  document_url: string | null
  generated_at: string
  sent_at: string | null
  signed_at: string | null
  voided_at: string | null
  created_at: string
  updated_at: string
}

export interface RentalSpaceSlotInput {
  venueId: string
  startAt: string
  endAt: string
}

export interface RentalAddonSelectionInput {
  rentalAddonId: string
  quantity: number
  unitPrice?: number
}

import type { OperationalSetupInput } from "@/lib/operational-briefs/operational-setup-input"

export interface SubmitVenueRentalInput {
  venueRentalEventTypeId?: string | null
  billingContactId?: string | null
  notes?: string | null
  spaces: RentalSpaceSlotInput[]
  addons?: RentalAddonSelectionInput[]
  operationalSetup?: OperationalSetupInput
}

/** Staff-created rental on behalf of any contact (Requests → Add). */
export interface CreateStaffVenueRentalInput {
  billingContactId: string
  venueRentalEventTypeId?: string | null
  notes?: string | null
  spaces: RentalSpaceSlotInput[]
  expectedAttendance?: number | null
  setupStyle?: string | null
}

export type PublicAvailabilityState =
  | "available"
  | "unavailable"
  | "limited"
  | "closed"

export interface PublicAvailabilitySlot {
  venueId: string
  startAt: string
  endAt: string
  state: PublicAvailabilityState
}

export type PublicAvailabilityBlock = {
  venueId: string
  startAt: string
  endAt: string
}

/** 72 hours after supervisor approval / payment notice */
export const RENTAL_HOLD_DURATION_MS = 72 * 60 * 60 * 1000

/** Remaining balance reminder threshold */
export const RENTAL_BALANCE_REMINDER_LEAD_MS = 7 * 24 * 60 * 60 * 1000

export interface VenueRentalSpaceSummary {
  venueId: string
  venueName: string
  startAt: string
  endAt: string
}

export interface VenueRentalAddonSummary {
  id: string
  name: string
  quantity: number
  unitPrice: number
}

export interface VenueRentalQueueRow {
  id: string
  shortId: string
  status: VenueRentalStatus
  statusLabel: string
  calendarColor: VenueRentalCalendarColor
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  billingContactId: string | null
  billingContactName: string | null
  billingContactType: "individual" | "organization" | null
  eventTypeName: string | null
  spaces: VenueRentalSpaceSummary[]
  addons: VenueRentalAddonSummary[]
  notes: string | null
  guestCount: number | null
  submittedAt: string
  submittedAtLabel: string
  holdExpiresAt: string | null
  hasConflict: boolean
}

export type VenueRentalPaymentBalanceFilter =
  | "all"
  | "unpaid"
  | "partial"
  | "paid"
  | "no_payments"

export interface VenueRentalPaymentReportRow {
  id: string
  shortId: string
  status: VenueRentalStatus
  statusLabel: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  eventTypeName: string | null
  spaceLabel: string
  eventStartAt: string | null
  totalFee: number
  depositAmount: number
  depositReceived: number
  securityAmount: number
  securityReceived: number
  remainingAmount: number
  remainingReceived: number
  remainingDue: number
  amountReceived: number
  balanceDue: number
  paymentBalance: VenueRentalPaymentBalanceFilter
  unpaidPaymentIds: {
    depositId: string | null
    securityId: string | null
    remainingId: string | null
  }
  /** Non-refund payment lines for edit/delete from the Payments report. */
  payments: Array<{
    id: string
    paymentType: RentalPaymentType
    status: RentalPaymentStatus
    amount: number
    notes: string | null
    paidAt: string | null
  }>
}

export interface VenueRentalDashboardStats {
  awaitingApprovalCount: number
  awaitingPaymentCount: number
  confirmedCount: number
  conflictCount: number
}

export interface RentalAddonCatalogItem {
  id: string
  name: string
  description: string | null
  defaultPrice: number
}

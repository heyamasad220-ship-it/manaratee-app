export type UnpaidRegistrationPolicy = "expire" | "keep_pending_payment"

export type CheckoutStatus =
  | "draft"
  | "open"
  | "processing"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled"

export type ChargeStatus =
  | "draft"
  | "pending_payment"
  | "partially_paid"
  | "paid"
  | "void"
  | "expired"
  | "written_off"

export type ChargeCheckoutStatus =
  | "not_started"
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "expired"

export type ChargeScheduleStatus =
  | "scheduled"
  | "due"
  | "paid"
  | "waived"
  | "void"
  | "adjusted"
  | "past_due"

export type CapacityHoldType = "none" | "soft" | "firm"

export type PaymentAllocationType =
  | "due_today"
  | "schedule"
  | "refund"
  | "adjustment"

export interface ProgramPaymentSettings {
  organization_id: string
  require_payment_at_registration: boolean
  unpaid_registration_policy: UnpaidRegistrationPolicy
  hold_capacity_on_pending_payment: boolean
  checkout_expiry_minutes: number
  created_at: string
  updated_at: string
}

export interface ProgramCheckout {
  id: string
  organization_id: string
  payer_contact_id: string | null
  registrant_contact_id: string | null
  currency: string
  subtotal: number
  discount_total: number
  total: number
  due_today: number
  payment_required: boolean
  checkout_status: CheckoutStatus
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  metadata: Record<string, unknown>
  expires_at: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface ProgramCharge {
  id: string
  organization_id: string
  checkout_id: string | null
  enrollment_id: string | null
  waitlist_id: string | null
  charge_type: "registration" | "addon" | "adjustment" | "fee"
  source_type: "program_registration" | "manual" | "addon" | "adjustment"
  source_id: string | null
  payer_contact_id: string | null
  registrant_contact_id: string | null
  participant_contact_id: string | null
  program_id: string | null
  offering_id: string | null
  registration_option_id: string | null
  fee_plan_id: string | null
  plan_type: string | null
  currency: string
  subtotal: number
  discount_total: number
  total: number
  due_today: number
  amount_paid: number
  payment_required: boolean
  charge_status: ChargeStatus
  checkout_status: ChargeCheckoutStatus
  quote_snapshot: Record<string, unknown>
  due_at: string | null
  paid_at: string | null
  voided_at: string | null
  expires_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ProgramChargeLine {
  id: string
  organization_id: string
  charge_id: string
  line_type: string
  label: string
  quantity: number
  unit_amount: number
  amount: number
  sort_order: number
  metadata: Record<string, unknown>
  created_at: string
}

export interface ProgramChargeScheduleItem {
  id: string
  organization_id: string
  charge_id: string
  billing_period_id?: string | null
  schedule_type: "deposit_balance" | "monthly" | "installment" | "custom"
  charge_category?: string
  label: string
  due_date: string | null
  amount: number
  original_amount?: number | null
  sequence_number: number
  status: ChargeScheduleStatus
  adjustment_reason?: string | null
  admin_notes?: string | null
  paid_at: string | null
  created_by?: string | null
  updated_by?: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ProgramPaymentAllocation {
  id: string
  organization_id: string
  payment_id: string | null
  checkout_id: string | null
  charge_id: string
  charge_schedule_id: string | null
  amount: number
  allocation_type: PaymentAllocationType
  metadata: Record<string, unknown>
  created_at: string
}

/** Bundle returned when loading a checkout for display (Phase 3 UI). */
export type ProgramCheckoutBundle = {
  checkout: ProgramCheckout
  charges: Array<
    ProgramCharge & {
      lines: ProgramChargeLine[]
      schedule: ProgramChargeScheduleItem[]
    }
  >
}

/** Maps fee plan type → what due_today represents at registration time. */
export const DUE_TODAY_RULES: Record<string, string> = {
  free: "No payment required ($0)",
  one_time: "Full program total",
  per_session: "Full selected session total",
  deposit_balance: "Deposit amount",
  monthly: "Registration fee + first month",
  installments: "First installment",
}

export function isPaymentRequiredAtRegistration(
  dueToday: number,
  settings?: Pick<ProgramPaymentSettings, "require_payment_at_registration"> | null
) {
  const requirePayment = settings?.require_payment_at_registration ?? true
  return requirePayment && dueToday > 0
}

export function initialEnrollmentStatusForQuote(
  dueToday: number,
  settings?: Pick<ProgramPaymentSettings, "require_payment_at_registration"> | null
) {
  return isPaymentRequiredAtRegistration(dueToday, settings)
    ? "pending_payment"
    : "pending"
}

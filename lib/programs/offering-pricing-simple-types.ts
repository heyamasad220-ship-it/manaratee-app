export type ChargeType =
  | "tuition"
  | "registration_fee"
  | "book_fee"
  | "materials"
  | "before_care"
  | "after_care"
  | "lunch"
  | "custom"

export type FeeRecurrence = "one_time" | "monthly"

export type FeeBillingScope = "individual" | "family"

/** @deprecated Prefer FeeRecurrence on each fee. Kept for payment-structure UI. */
export type PaymentStructure = "one_time" | "monthly" | "installments"

/** @deprecated Add-ons merged into OfferingFee. */
export type AddonBillingMethod = "flat" | "per_day" | "per_session" | "per_week"

export type OfferingFee = {
  clientId: string
  componentId?: string
  /** Display name; auto-filled from fee type unless custom. */
  name: string
  amount: number
  required: boolean
  feeType: ChargeType
  recurrence: FeeRecurrence
  billingScope: FeeBillingScope
}

/** @deprecated Use OfferingFee. */
export type OfferingCharge = {
  clientId: string
  componentId?: string
  name: string
  amount: number
  required: boolean
  chargeType: ChargeType
}

/** @deprecated Use OfferingFee. */
export type OfferingAddon = {
  clientId: string
  componentId?: string
  name: string
  amount: number
  billingMethod: AddonBillingMethod
}

export type SimplePricingDiscountLine = {
  ruleId?: string
  enabled: boolean
  percent: number
  /** Early bird: last day to receive the discount (YYYY-MM-DD). */
  endsBefore?: string
  /** Member/staff: org discount tag that unlocks this percent. */
  discountTagId?: string | null
}

export type SimplePricingDiscounts = {
  earlyBird: SimplePricingDiscountLine
  fullPayment: SimplePricingDiscountLine
  sibling: SimplePricingDiscountLine
  member: SimplePricingDiscountLine
  staff: SimplePricingDiscountLine
}

export type SimpleOfferingPricing = {
  fees: OfferingFee[]
  paymentDueDay: number | null
  discounts: SimplePricingDiscounts
  /** Derived for billing calendar / legacy payment structure. */
  paymentStructure: PaymentStructure
  installmentCount: number | null
  /** @deprecated Migrated into fees on parse. */
  charges?: OfferingCharge[]
  /** @deprecated Migrated into fees on parse. */
  addons?: OfferingAddon[]
}

export const FEE_TYPE_LABELS: Record<ChargeType, string> = {
  tuition: "Tuition",
  registration_fee: "Registration Fee",
  book_fee: "Book Fee",
  materials: "Materials Fee",
  before_care: "Before Care",
  after_care: "After Care",
  lunch: "Lunch",
  custom: "Custom",
}

/** @deprecated Use FEE_TYPE_LABELS */
export const CHARGE_TYPE_LABELS = FEE_TYPE_LABELS

export const FEE_RECURRENCE_LABELS: Record<FeeRecurrence, string> = {
  one_time: "One-time",
  monthly: "Monthly",
}

export const FEE_BILLING_SCOPE_LABELS: Record<FeeBillingScope, string> = {
  individual: "Individual",
  family: "Family (flat)",
}

export const ADDON_BILLING_METHOD_LABELS: Record<AddonBillingMethod, string> = {
  flat: "Flat Fee",
  per_day: "Per Day",
  per_session: "Per Session",
  per_week: "Per Week",
}

export const PAYMENT_STRUCTURE_LABELS: Record<PaymentStructure, string> = {
  one_time: "One-Time Payment",
  monthly: "Monthly Billing",
  installments: "Installments",
}

export function defaultFeeName(feeType: ChargeType) {
  return FEE_TYPE_LABELS[feeType]
}

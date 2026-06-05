export type ChargeType =
  | "tuition"
  | "registration_fee"
  | "book_fee"
  | "materials"
  | "technology_fee"
  | "supply_fee"
  | "uniform_fee"
  | "custom"

export type PaymentStructure = "one_time" | "monthly" | "installments"

export type AddonBillingMethod = "flat" | "per_day" | "per_session" | "per_week"

export type OfferingCharge = {
  clientId: string
  componentId?: string
  name: string
  amount: number
  required: boolean
  chargeType: ChargeType
}

export type OfferingAddon = {
  clientId: string
  componentId?: string
  name: string
  amount: number
  billingMethod: AddonBillingMethod
}

export type SimpleOfferingPricing = {
  charges: OfferingCharge[]
  addons: OfferingAddon[]
  paymentStructure: PaymentStructure
  installmentCount: number | null
  paymentDueDay: number | null
}

export const CHARGE_TYPE_LABELS: Record<ChargeType, string> = {
  tuition: "Tuition",
  registration_fee: "Registration Fee",
  book_fee: "Book Fee",
  materials: "Materials Fee",
  technology_fee: "Technology Fee",
  supply_fee: "Supply Fee",
  uniform_fee: "Uniform Fee",
  custom: "Custom",
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

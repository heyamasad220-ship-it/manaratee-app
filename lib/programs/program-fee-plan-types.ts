export type FeePlanType =
  | "free"
  | "one_time"
  | "deposit_balance"
  | "monthly"
  | "installments"
  | "per_session"

export type FeeComponentType =
  | "tuition"
  | "registration_fee"
  | "materials"
  | "lunch"
  | "extended_care"
  | "custom"

export type FeePricingModel = "flat" | "per_session" | "per_month" | "percent_of_tuition"

export type FeeQuantityMode =
  | "fixed"
  | "session_count"
  | "month_count"
  | "addon_selected"

export type DiscountRuleType = "sibling" | "multi_session" | "early_bird" | "custom"

export type DiscountType = "percent" | "fixed_amount"

export interface ProgramOfferingFeePlan {
  id: string
  organization_id: string
  program_id: string
  offering_id: string
  name: string
  plan_type: FeePlanType
  currency: string
  is_default: boolean
  is_active: boolean
  deposit_amount: number
  payment_due_day: number | null
  installment_count: number | null
  effective_from: string | null
  effective_until: string | null
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ProgramOfferingFeePlanComponent {
  id: string
  organization_id: string
  fee_plan_id: string
  component_type: FeeComponentType
  label: string
  amount: number
  pricing_model: FeePricingModel
  quantity_mode: FeeQuantityMode
  quantity_value: number
  addon_key: string | null
  session_price_source: "component" | "session_table"
  applies_to_option_types: string[] | null
  sort_order: number
  is_active: boolean
}

export interface ProgramOfferingDiscountRule {
  id: string
  organization_id: string
  offering_id: string
  fee_plan_id: string | null
  rule_type: DiscountRuleType
  label: string
  discount_type: DiscountType
  amount: number
  conditions: Record<string, unknown>
  is_active: boolean
  priority_rank: number
}

export type FeePlanBundle = {
  plan: ProgramOfferingFeePlan
  components: ProgramOfferingFeePlanComponent[]
  discountRules: ProgramOfferingDiscountRule[]
}

export const FEE_PLAN_TYPE_LABELS: Record<FeePlanType, string> = {
  free: "Free",
  one_time: "One-Time Payment",
  deposit_balance: "Deposit + Balance",
  monthly: "Monthly",
  installments: "Installments",
  per_session: "Per Session",
}

export const FEE_COMPONENT_TYPE_LABELS: Record<FeeComponentType, string> = {
  tuition: "Tuition",
  registration_fee: "Registration Fee",
  materials: "Materials",
  lunch: "Lunch",
  extended_care: "Extended Care",
  custom: "Custom",
}

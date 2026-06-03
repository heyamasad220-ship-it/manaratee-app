export type BillingPeriodStatus = "active" | "skipped"

export type BillingOverrideType =
  | "skip"
  | "waive"
  | "adjust_amount"
  | "add_fee"

export type ChargeScheduleStatus =
  | "scheduled"
  | "due"
  | "paid"
  | "waived"
  | "void"
  | "adjusted"
  | "past_due"

export type ChargeCategory =
  | "tuition"
  | "registration_fee"
  | "one_time_fee"
  | "addon"
  | "adjustment"
  | "materials"
  | "custom"

export interface ProgramOfferingBillingPeriod {
  id: string
  organization_id: string
  program_id: string
  offering_id: string
  period_key: string
  period_label: string
  period_start: string
  period_end: string
  due_date: string
  sequence_number: number
  default_tuition_amount: number | null
  period_status: BillingPeriodStatus
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export interface ProgramBillingOverride {
  id: string
  organization_id: string
  program_id: string
  offering_id: string
  billing_period_id: string | null
  enrollment_id: string | null
  override_type: BillingOverrideType
  label: string
  amount: number | null
  original_amount: number | null
  reason: string | null
  admin_notes: string | null
  apply_to_all: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface ProgramChargeScheduleItemExtended {
  id: string
  organization_id: string
  charge_id: string
  billing_period_id: string | null
  schedule_type: string
  charge_category: ChargeCategory
  label: string
  due_date: string | null
  amount: number
  original_amount: number | null
  sequence_number: number
  status: ChargeScheduleStatus
  adjustment_reason: string | null
  admin_notes: string | null
  paid_at: string | null
  created_by: string | null
  updated_by: string | null
  override_id: string | null
  created_at: string
  updated_at: string
}

export type ParticipantBillingRow = {
  enrollment_id: string
  charge_id: string | null
  participant_name: string
  status: string | null
  balance_due: number
  balance_paid: number
  balance_total: number
  schedule_items: ProgramChargeScheduleItemExtended[]
}

export type OfferingBillingScheduleBundle = {
  offering: {
    id: string
    name: string
    start_date: string | null
    end_date: string | null
  }
  billing_periods: ProgramOfferingBillingPeriod[]
  participants: ParticipantBillingRow[]
  overrides: ProgramBillingOverride[]
}

export const CHARGE_SCHEDULE_STATUS_LABELS: Record<ChargeScheduleStatus, string> =
  {
    scheduled: "Scheduled",
    due: "Due",
    paid: "Paid",
    waived: "Waived",
    void: "Void",
    adjusted: "Adjusted",
    past_due: "Past Due",
  }

export const BILLING_OVERRIDE_TYPE_LABELS: Record<BillingOverrideType, string> =
  {
    skip: "Skip Month",
    waive: "Waive Charge",
    adjust_amount: "Adjust Amount",
    add_fee: "Add Fee",
  }

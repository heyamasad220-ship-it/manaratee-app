import type { ProgramStatus } from "./program-status"
import type { ProgramKind } from "./program-kind"

export type { ProgramKind }

export interface Program {
  id: string

  organization_id: string

  name: string
  subtitle: string | null
  description: string | null

  /** academic = year + offerings; seasonal = single camp/season product. */
  program_kind: ProgramKind

  department_id: string | null
  flyer_url: string | null
  background_color: string | null
  title_color: string | null
  subtitle_color: string | null

  start_date: string | null
  end_date: string | null

  enrollment_open_date: string | null
  enrollment_close_date: string | null

  /** direct_registration = register without applying; application_approval = apply then register. */
  enrollment_process?: "direct_registration" | "application_approval" | null
  /** When true, application-based programs require an evaluation before approval. */
  evaluation_required?: boolean | null
  /** on_registration = Active on submit; after_initial_payment = Pending until first payment. */
  seat_activation_rule?: "on_registration" | "after_initial_payment" | null

  financial_assistance_enabled: boolean
financial_assistance_open: boolean
financial_assistance_close_date: string | null
financial_assistance_instructions: string | null
program_type: "adult" | "youth"
min_age: number | null
max_age: number | null
min_grade: string | null
max_grade: string | null
require_guardian: boolean
require_grade: boolean
require_emergency_contact: boolean
enable_waitlist: boolean
waitlist_capacity: number | null
/** Optional default for new offerings (S1+); offerings may override. */
waitlist_offer_deadline_days: number | null
billing_type: "free" | "one_time" | "deposit_balance" | "monthly" | "installments"
tuition_amount: number
deposit_amount: number
monthly_amount: number
installment_count: number | null
payment_due_day: number | null

  requires_volunteers?: boolean
  requires_childcare?: boolean
  requires_vendors?: boolean
  service_requirements?: Record<string, unknown> | null

  age_groups: string[]
  grade_levels: string[]

  gender: string | null

  capacity: number
  enrolled: number
  waitlist: number

  status: ProgramStatus

  created_at: string
  updated_at: string
}
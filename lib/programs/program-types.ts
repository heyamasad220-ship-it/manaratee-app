import type { ProgramStatus } from "./program-status"

export interface Program {
  id: string

  organization_id: string

  name: string
  description: string | null

  department_id: string | null

  start_date: string | null
  end_date: string | null

  enrollment_open_date: string | null
  enrollment_close_date: string | null

  financial_assistance_enabled: boolean
financial_assistance_open: boolean
financial_assistance_close_date: string | null
financial_assistance_instructions: string | null
program_type: "adult" | "youth" | "family"
min_age: number | null
max_age: number | null
min_grade: string | null
max_grade: string | null
require_guardian: boolean
require_grade: boolean
require_emergency_contact: boolean
enable_waitlist: boolean
waitlist_capacity: number | null
billing_type: "free" | "one_time" | "deposit_balance" | "monthly" | "installments"
tuition_amount: number
deposit_amount: number
monthly_amount: number
installment_count: number | null
payment_due_day: number | null

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
"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

type CreateProgramInput = {
  name: string
  description?: string
  department_id?: string | null
  start_date?: string | null
  end_date?: string | null
  enrollment_open_date?: string | null
  enrollment_close_date?: string | null
  age_groups?: string[]
  grade_levels?: string[]
  gender?: string | null
  capacity?: number
  status?: string
}

export async function createProgram(input: CreateProgramInput) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase.from("programs").insert({
    organization_id: organizationId,
    name: input.name,
    description: input.description || null,
    department_id: input.department_id || null,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    enrollment_open_date: input.enrollment_open_date || null,
    enrollment_close_date: input.enrollment_close_date || null,
    age_groups: input.age_groups || [],
    grade_levels: input.grade_levels || [],
    gender: input.gender || "All",
    capacity: input.capacity || 0,
    enrolled: 0,
    waitlist: 0,
    status: input.status || "draft",
  })

  if (error) {
    console.error(error)
    throw new Error("Failed to create program")
  }

  revalidatePath("/programs")
}
type UpdateProgramInput = {
  id: string
  name: string
  description?: string
  department_id?: string | null
  start_date?: string | null
  end_date?: string | null
  enrollment_open_date?: string | null
  enrollment_close_date?: string | null
  age_groups?: string[]
  grade_levels?: string[]
  gender?: string | null
  capacity?: number
  status?: string
  financial_assistance_enabled?: boolean
financial_assistance_open?: boolean
financial_assistance_close_date?: string | null
financial_assistance_instructions?: string | null
program_type?: "adult" | "youth" | "family"
min_age?: number | null
max_age?: number | null
min_grade?: string | null
max_grade?: string | null
require_guardian?: boolean
require_grade?: boolean
require_emergency_contact?: boolean
enable_waitlist?: boolean
waitlist_capacity?: number | null
billing_type?: "free" | "one_time" | "deposit_balance" | "monthly" | "installments"
tuition_amount?: number
deposit_amount?: number
monthly_amount?: number
installment_count?: number | null
payment_due_day?: number | null
visibility?: "public" | "private" | "members_only"
}

export async function updateProgram(input: UpdateProgramInput) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("programs")
    .update({
      name: input.name,
      description: input.description || null,
      department_id: input.department_id || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      enrollment_open_date: input.enrollment_open_date || null,
      enrollment_close_date: input.enrollment_close_date || null,
      age_groups: input.age_groups || [],
      grade_levels: input.grade_levels || [],
      gender: input.gender || "All",
      capacity: input.capacity || 0,
      status: input.status || "draft",
      financial_assistance_enabled: input.financial_assistance_enabled || false,
      financial_assistance_open: input.financial_assistance_open || false,
      financial_assistance_close_date: input.financial_assistance_close_date || null,
      financial_assistance_instructions: input.financial_assistance_instructions || null,
      updated_at: new Date().toISOString(),
      program_type: input.program_type,
min_age: input.min_age,
max_age: input.max_age,
min_grade: input.min_grade,
max_grade: input.max_grade,
require_guardian: input.require_guardian,
require_grade: input.require_grade,
require_emergency_contact: input.require_emergency_contact,
enable_waitlist: input.enable_waitlist,
waitlist_capacity: input.waitlist_capacity,
billing_type: input.billing_type,
tuition_amount: input.tuition_amount,
deposit_amount: input.deposit_amount,
monthly_amount: input.monthly_amount,
installment_count: input.installment_count,
visibility: input.visibility,
payment_due_day: input.payment_due_day,
    })
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error("Failed to update program")
  }

  revalidatePath("/programs")
  revalidatePath(`/programs/${input.id}`)
}
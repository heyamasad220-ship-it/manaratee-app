"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { ensureDefaultOffering } from "@/lib/programs/program-offering-actions"
import { syncRegistrationOptionsFromProgramFlags } from "@/lib/programs/program-registration-option-actions"

import { getAgeGroupLabelsFromMinMax } from "@/lib/programs/program-eligibility-display"
import {
  getTodayDateString,
  shouldCloseEnrollmentForStatus,
} from "@/lib/programs/program-enrollment-availability"

function isMissingAgeColumnError(error: { message?: string; code?: string }) {
  const message = (error.message || "").toLowerCase()

  return (
    error.code === "PGRST204" ||
    message.includes("min_age") ||
    message.includes("max_age") ||
    message.includes("schema cache")
  )
}

function isMissingColumnError(error: { message?: string; code?: string }) {
  const message = (error.message || "").toLowerCase()

  return (
    error.code === "PGRST204" ||
    message.includes("schema cache") ||
    (message.includes("column") && message.includes("does not exist"))
  )
}

type CreateProgramInput = {
  name: string
  subtitle?: string | null
  description?: string
  department_id?: string | null
  flyer_url?: string | null
  background_color?: string | null
  program_type?: "adult" | "youth" | "family"
  start_date?: string | null
  end_date?: string | null
  enrollment_open_date?: string | null
  enrollment_close_date?: string | null
  grade_levels?: string[]
  min_grade?: string | null
  max_grade?: string | null
  gender?: string | null
  capacity?: number
  status?: string
  visibility?: "public" | "private" | "members_only"
  full_program_registration_enabled?: boolean
  session_registration_enabled?: boolean
  min_age?: number | null
  max_age?: number | null
  require_guardian?: boolean
  require_grade?: boolean
  require_emergency_contact?: boolean
}

export async function createProgram(input: CreateProgramInput) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  if (
    input.min_age != null &&
    input.max_age != null &&
    input.min_age > input.max_age
  ) {
    throw new Error("Minimum age cannot be greater than maximum age.")
  }

  const status = input.status || "draft"
  const enrollmentCloseDate = shouldCloseEnrollmentForStatus(status)
    ? getTodayDateString()
    : input.enrollment_close_date || null

  const { data, error } = await supabase
    .from("programs")
    .insert({
      organization_id: organizationId,
      name: input.name,
      subtitle: input.subtitle || null,
      description: input.description || null,
      department_id: input.department_id || null,
      flyer_url: input.flyer_url || null,
      background_color: input.background_color || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      enrollment_open_date: input.enrollment_open_date || null,
      enrollment_close_date: enrollmentCloseDate,

      program_type: input.program_type || "youth",
      age_groups: getAgeGroupLabelsFromMinMax(input.min_age, input.max_age),
      grade_levels: input.grade_levels || [],
      min_grade: input.min_grade ?? null,
      max_grade: input.max_grade ?? null,
      gender: input.gender || "All",
      min_age: input.min_age ?? null,
      max_age: input.max_age ?? null,

      require_guardian:
        input.require_guardian ??
        (input.program_type === "adult" ? false : true),
      require_grade: input.require_grade ?? false,
      require_emergency_contact: input.require_emergency_contact ?? true,

      full_program_registration_enabled:
        input.full_program_registration_enabled ?? true,
      session_registration_enabled:
        input.session_registration_enabled ?? false,

      capacity: input.capacity || 0,
      enrolled: 0,
      waitlist: 0,
      status,
      visibility: input.visibility || "public",
    })
    .select("id")
    .single()

  if (error) {
    console.error(error)
    throw new Error("Failed to create program")
  }

  const programId = data.id as string

  const offeringId = await ensureDefaultOffering({
    organizationId,
    programId,
    programName: input.name,
    startDate: input.start_date,
    endDate: input.end_date,
    enrollmentOpenDate: input.enrollment_open_date,
    enrollmentCloseDate: enrollmentCloseDate,
    programStatus: status,
  })

  await syncRegistrationOptionsFromProgramFlags({
    organizationId,
    programId,
    offeringId,
    fullProgramEnabled: input.full_program_registration_enabled ?? true,
    sessionRegistrationEnabled: input.session_registration_enabled ?? false,
  })

  revalidatePath("/programs")
  revalidatePath("/programs/catalog")

  return programId
}

type UpdateProgramInput = {
  id: string
  name: string
  subtitle?: string | null
  description?: string
  department_id?: string | null
  flyer_url?: string | null
  background_color?: string | null
  start_date?: string | null
  end_date?: string | null
  enrollment_open_date?: string | null
  enrollment_close_date?: string | null
  age_groups?: string[]
  grade_levels?: string[]
  gender?: string | null
  capacity?: number
  status?: string

  full_program_registration_enabled?: boolean
  session_registration_enabled?: boolean
  single_session_registration_enabled?: boolean
  drop_in_registration_enabled?: boolean

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

  billing_type?:
    | "free"
    | "one_time"
    | "deposit_balance"
    | "monthly"
    | "installments"
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

  const minAge = input.min_age ?? null
  const maxAge = input.max_age ?? null

  if (minAge !== null && maxAge !== null && minAge > maxAge) {
    throw new Error("Minimum age cannot be greater than maximum age.")
  }

  const ageGroups =
    input.age_groups?.length
      ? input.age_groups
      : getAgeGroupLabelsFromMinMax(minAge, maxAge)

  const status = input.status || "draft"
  let enrollmentOpenDate = input.enrollment_open_date || null
  let enrollmentCloseDate = input.enrollment_close_date || null

  if (shouldCloseEnrollmentForStatus(status)) {
    const today = getTodayDateString()
    if (!enrollmentCloseDate || enrollmentCloseDate > today) {
      enrollmentCloseDate = today
    }
  }

  const programPayload = {
    name: input.name,
    subtitle: input.subtitle || null,
    description: input.description || null,
    department_id: input.department_id || null,
    flyer_url: input.flyer_url || null,
    background_color: input.background_color || null,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    enrollment_open_date: enrollmentOpenDate,
    enrollment_close_date: enrollmentCloseDate,

    age_groups: ageGroups,
    grade_levels: input.grade_levels || [],
    gender: input.gender || "All",
    min_age: minAge,
    max_age: maxAge,
    min_grade: input.min_grade ?? null,
    max_grade: input.max_grade ?? null,

    full_program_registration_enabled:
      input.full_program_registration_enabled ?? true,
    session_registration_enabled:
      input.session_registration_enabled ?? false,

    capacity: input.capacity || 0,
    status,

    financial_assistance_enabled:
      input.financial_assistance_enabled || false,
    financial_assistance_open:
      input.financial_assistance_open || false,
    financial_assistance_close_date:
      input.financial_assistance_close_date || null,
    financial_assistance_instructions:
      input.financial_assistance_instructions || null,

    updated_at: new Date().toISOString(),

    program_type: input.program_type,
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
    payment_due_day: input.payment_due_day,

    visibility: input.visibility,
  }

  let { error } = await supabase
    .from("programs")
    .update(programPayload)
    .eq("id", input.id)
    .eq("organization_id", organizationId)

  if (error && isMissingAgeColumnError(error)) {
    const { min_age: _minAge, max_age: _maxAge, ...withoutAgeBounds } =
      programPayload
    ;({ error } = await supabase
      .from("programs")
      .update(withoutAgeBounds)
      .eq("id", input.id)
      .eq("organization_id", organizationId))
  }

  if (error) {
    console.error("[updateProgram]", error)
    throw new Error(error.message || "Failed to update program")
  }

  await ensureDefaultOffering({
    organizationId,
    programId: input.id,
    programName: input.name,
    startDate: input.start_date,
    endDate: input.end_date,
    enrollmentOpenDate,
    enrollmentCloseDate,
    programStatus: status,
  })

  revalidatePath("/programs")
  revalidatePath("/programs/catalog")
  revalidatePath(`/programs/${input.id}/edit`)
  revalidatePath("/customer/programs")
  revalidatePath(`/customer/programs/${input.id}`)
  revalidatePath(`/customer/programs/${input.id}/register`)
}
"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { updateProgram } from "@/lib/programs/program-actions"
import { getAgeGroupLabelsFromMinMax } from "@/lib/programs/program-eligibility-display"
import { normalizeProgramAudienceType } from "@/lib/programs/program-offering-attributes"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"

function emptyToNull(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim()
  return trimmed ? trimmed : null
}

function inferProgramTypeFromMinAge(
  minAge: number | null
): "adult" | "youth" {
  return minAge !== null && minAge >= 18 ? "adult" : "youth"
}

type ProgramBasicsInput = {
  programId: string
  name: string
  subtitle?: string | null
  description?: string | null
  department_id?: string | null
  flyer_url?: string | null
  background_color?: string | null
  visibility?: "public" | "private" | "members_only"
  status?: string
  start_date?: string | null
  end_date?: string | null
  enrollment_open_date?: string | null
  enrollment_close_date?: string | null
  gender?: string | null
  min_age?: number | null
  max_age?: number | null
  /** When true (default), push schedule dates onto all non-archived offerings. */
  syncOfferingDates?: boolean
}

export type UpdateProgramBasicsResult =
  | { success: true }
  | { success: false; error: string }

export async function updateProgramBasics(
  input: ProgramBasicsInput
): Promise<UpdateProgramBasicsResult> {
  const name = input.name.trim()
  if (!name) {
    return { success: false, error: "Program name is required." }
  }

  const minAge =
    input.min_age !== undefined ? input.min_age : undefined
  const maxAge =
    input.max_age !== undefined ? input.max_age : undefined

  if (
    minAge != null &&
    maxAge != null &&
    Number.isFinite(minAge) &&
    Number.isFinite(maxAge) &&
    minAge > maxAge
  ) {
    return { success: false, error: "Minimum age cannot be greater than maximum age." }
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("id", input.programId)
    .eq("organization_id", organizationId)
    .single()

  if (error || !data) {
    return { success: false, error: "Program not found." }
  }

  const program = data as Record<string, unknown> & {
    id: string
    name: string
    subtitle?: string | null
    description?: string | null
    department_id?: string | null
    flyer_url?: string | null
    background_color?: string | null
    start_date?: string | null
    end_date?: string | null
    enrollment_open_date?: string | null
    enrollment_close_date?: string | null
    age_groups?: string[] | null
    grade_levels?: string[] | null
    gender?: string | null
    capacity?: number | null
    status?: string | null
    program_type?: "adult" | "youth"
    min_age?: number | null
    max_age?: number | null
    min_grade?: string | null
    max_grade?: string | null
    require_guardian?: boolean
    require_grade?: boolean
    require_emergency_contact?: boolean
    full_program_registration_enabled?: boolean
    session_registration_enabled?: boolean
    single_session_registration_enabled?: boolean
    drop_in_registration_enabled?: boolean
    enable_waitlist?: boolean
    waitlist_capacity?: number | null
    visibility?: "public" | "private" | "members_only"
    financial_assistance_enabled?: boolean
    financial_assistance_open?: boolean
    financial_assistance_close_date?: string | null
    financial_assistance_instructions?: string | null
    billing_type?:
      | "free"
      | "one_time"
      | "deposit_balance"
      | "monthly"
      | "installments"
    tuition_amount?: number | null
    deposit_amount?: number | null
    monthly_amount?: number | null
    installment_count?: number | null
    payment_due_day?: number | null
  }

  const visibility = input.visibility ?? program.visibility ?? "public"
  const status = input.status ?? program.status ?? "draft"
  const startDate =
    input.start_date !== undefined
      ? emptyToNull(input.start_date)
      : program.start_date ?? null
  const endDate =
    input.end_date !== undefined
      ? emptyToNull(input.end_date)
      : program.end_date ?? null
  const enrollmentOpenDate =
    input.enrollment_open_date !== undefined
      ? emptyToNull(input.enrollment_open_date)
      : program.enrollment_open_date ?? null
  const enrollmentCloseDate =
    input.enrollment_close_date !== undefined
      ? emptyToNull(input.enrollment_close_date)
      : program.enrollment_close_date ?? null
  const resolvedMinAge =
    minAge !== undefined ? minAge : program.min_age ?? null
  const resolvedMaxAge =
    maxAge !== undefined ? maxAge : program.max_age ?? null
  const gender =
    input.gender !== undefined
      ? emptyToNull(input.gender) || "All"
      : program.gender ?? "All"

  try {
    await updateProgram({
      id: program.id,
      name,
      subtitle: input.subtitle ?? program.subtitle ?? null,
      description: input.description ?? program.description ?? "",
      department_id:
        input.department_id !== undefined
          ? input.department_id
          : program.department_id ?? null,
      flyer_url:
        input.flyer_url !== undefined
          ? input.flyer_url
          : program.flyer_url ?? null,
      background_color:
        input.background_color !== undefined
          ? input.background_color
          : program.background_color ?? null,
      start_date: startDate,
      end_date: endDate,
      enrollment_open_date: enrollmentOpenDate,
      enrollment_close_date: enrollmentCloseDate,
      age_groups: getAgeGroupLabelsFromMinMax(resolvedMinAge, resolvedMaxAge),
      grade_levels: program.grade_levels ?? [],
      gender,
      status,
      program_type:
        resolvedMinAge != null
          ? inferProgramTypeFromMinAge(resolvedMinAge)
          : normalizeProgramAudienceType(program.program_type),
      min_age: resolvedMinAge,
      max_age: resolvedMaxAge,
      min_grade: program.min_grade ?? null,
      max_grade: program.max_grade ?? null,
      require_guardian: program.require_guardian ?? true,
      require_grade: program.require_grade ?? false,
      require_emergency_contact: program.require_emergency_contact ?? true,
      visibility,
      financial_assistance_enabled:
        program.financial_assistance_enabled ?? false,
      financial_assistance_open: program.financial_assistance_open ?? false,
      financial_assistance_close_date:
        program.financial_assistance_close_date ?? null,
      financial_assistance_instructions:
        program.financial_assistance_instructions ?? null,
      identityAndDefaultsOnly: true,
    })

    if (input.syncOfferingDates !== false) {
      await supabase
        .from("program_offerings")
        .update({
          start_date: startDate,
          end_date: endDate,
          enrollment_open_date: enrollmentOpenDate,
          enrollment_close_date: enrollmentCloseDate,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organizationId)
        .eq("program_id", input.programId)
        .eq("inherit_dates", true)
        .neq("status", "archived")
    }

    revalidatePath(`/programs/${input.programId}`)
    revalidatePath("/programs/catalog")
    revalidatePath("/programs")
    if (program.department_id) {
      revalidatePath(workforceDepartmentDetailPath(program.department_id as string))
    }

    return { success: true }
  } catch (updateError) {
    console.error("[updateProgramBasics]", updateError)
    return {
      success: false,
      error:
        updateError instanceof Error
          ? updateError.message
          : "Failed to save program.",
    }
  }
}

export type ProgramEnrollmentDefaultsInput = {
  programId: string
  start_date: string | null
  end_date: string | null
  enrollment_open_date: string | null
  enrollment_close_date: string | null
  program_type: "adult" | "youth"
  min_age: number | null
  max_age: number | null
  grade_levels: string[]
  gender: string
  full_program_registration_enabled: boolean
  session_registration_enabled: boolean
  single_session_registration_enabled: boolean
  enable_waitlist: boolean
  waitlist_capacity: number | null
}

/** F2: Save program enrollment defaults and snapshot onto inheriting offerings. */
export async function saveProgramEnrollmentDefaults(
  input: ProgramEnrollmentDefaultsInput
): Promise<UpdateProgramBasicsResult> {
  if (
    input.min_age != null &&
    input.max_age != null &&
    input.min_age > input.max_age
  ) {
    return {
      success: false,
      error: "Minimum age cannot be greater than maximum age.",
    }
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("id", input.programId)
    .eq("organization_id", organizationId)
    .single()

  if (error || !data) {
    return { success: false, error: "Program not found." }
  }

  const program = data as Record<string, unknown> & {
    id: string
    name: string
    subtitle?: string | null
    description?: string | null
    department_id?: string | null
    flyer_url?: string | null
    background_color?: string | null
    status?: string | null
    visibility?: "public" | "private" | "members_only"
    min_grade?: string | null
    max_grade?: string | null
    require_guardian?: boolean
    require_grade?: boolean
    require_emergency_contact?: boolean
    financial_assistance_enabled?: boolean
    financial_assistance_open?: boolean
    financial_assistance_close_date?: string | null
    financial_assistance_instructions?: string | null
  }

  const gradeLevels =
    input.program_type === "adult" ? [] : input.grade_levels
  const requireGuardian = input.program_type !== "adult"

  try {
    await updateProgram({
      id: program.id,
      name: program.name,
      subtitle: program.subtitle ?? null,
      description: (program.description as string) ?? "",
      department_id: program.department_id ?? null,
      flyer_url: program.flyer_url ?? null,
      background_color: program.background_color ?? null,
      start_date: emptyToNull(input.start_date),
      end_date: emptyToNull(input.end_date),
      enrollment_open_date: emptyToNull(input.enrollment_open_date),
      enrollment_close_date: emptyToNull(input.enrollment_close_date),
      age_groups: getAgeGroupLabelsFromMinMax(input.min_age, input.max_age),
      grade_levels: gradeLevels,
      gender: emptyToNull(input.gender) || "All",
      status: program.status ?? "draft",
      program_type: input.program_type,
      min_age: input.min_age,
      max_age: input.max_age,
      min_grade: program.min_grade ?? null,
      max_grade: program.max_grade ?? null,
      require_guardian: requireGuardian,
      require_grade: program.require_grade ?? false,
      require_emergency_contact: program.require_emergency_contact ?? true,
      visibility: program.visibility ?? "public",
      financial_assistance_enabled:
        program.financial_assistance_enabled ?? false,
      financial_assistance_open: program.financial_assistance_open ?? false,
      financial_assistance_close_date:
        program.financial_assistance_close_date ?? null,
      financial_assistance_instructions:
        program.financial_assistance_instructions ?? null,
      full_program_registration_enabled:
        input.full_program_registration_enabled,
      session_registration_enabled: input.session_registration_enabled,
      single_session_registration_enabled:
        input.single_session_registration_enabled,
      enable_waitlist: input.enable_waitlist,
      waitlist_capacity: input.waitlist_capacity,
      identityAndDefaultsOnly: true,
    })

    const { syncInheritingOfferingsFromProgram } = await import(
      "@/lib/programs/program-offering-actions"
    )
    await syncInheritingOfferingsFromProgram({
      organizationId,
      programId: input.programId,
    })

    revalidatePath(`/programs/${input.programId}`)
    revalidatePath("/programs/catalog")
    revalidatePath("/programs")
    if (program.department_id) {
      revalidatePath(
        workforceDepartmentDetailPath(program.department_id as string)
      )
    }

    return { success: true }
  } catch (saveError) {
    console.error("[saveProgramEnrollmentDefaults]", saveError)
    return {
      success: false,
      error:
        saveError instanceof Error
          ? saveError.message
          : "Failed to save program defaults.",
    }
  }
}

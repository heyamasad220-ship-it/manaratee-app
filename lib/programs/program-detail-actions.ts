"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { updateProgram } from "@/lib/programs/program-actions"
import { getAgeGroupLabelsFromMinMax } from "@/lib/programs/program-eligibility-display"
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
    program_type?: "adult" | "youth" | "family"
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
      capacity: program.capacity ?? 0,
      status,
      program_type:
        resolvedMinAge != null
          ? inferProgramTypeFromMinAge(resolvedMinAge)
          : program.program_type || "family",
      min_age: resolvedMinAge,
      max_age: resolvedMaxAge,
      min_grade: program.min_grade ?? null,
      max_grade: program.max_grade ?? null,
      require_guardian: program.require_guardian ?? true,
      require_grade: program.require_grade ?? false,
      require_emergency_contact: program.require_emergency_contact ?? true,
      full_program_registration_enabled:
        program.full_program_registration_enabled ?? true,
      session_registration_enabled:
        program.session_registration_enabled ?? false,
      single_session_registration_enabled:
        program.single_session_registration_enabled ?? false,
      drop_in_registration_enabled:
        program.drop_in_registration_enabled ?? false,
      enable_waitlist: program.enable_waitlist ?? false,
      waitlist_capacity: program.waitlist_capacity ?? null,
      visibility,
      financial_assistance_enabled:
        program.financial_assistance_enabled ?? false,
      financial_assistance_open: program.financial_assistance_open ?? false,
      financial_assistance_close_date:
        program.financial_assistance_close_date ?? null,
      financial_assistance_instructions:
        program.financial_assistance_instructions ?? null,
      billing_type: program.billing_type ?? "free",
      tuition_amount: program.tuition_amount ?? 0,
      deposit_amount: program.deposit_amount ?? 0,
      monthly_amount: program.monthly_amount ?? 0,
      installment_count: program.installment_count ?? null,
      payment_due_day: program.payment_due_day ?? null,
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

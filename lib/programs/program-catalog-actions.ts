"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { replaceProgramCapacityGroups } from "@/lib/programs/program-capacity-group-actions"
import { getOfferingCapacityGroups } from "@/lib/programs/program-capacity-group-queries"
import {
  createProgram,
  ensureProgramHasOfferingForLegacyCopy,
  updateProgram,
} from "@/lib/programs/program-actions"
import {
  getFeePlanBundleForOffering,
} from "@/lib/programs/program-fee-plan-queries"
import { saveOfferingFeePlans } from "@/lib/programs/program-fee-plan-actions"
import {
  buildCopyName,
  buildDiscountRuleInputs,
  buildFeePlanInputs,
} from "@/lib/programs/program-fee-plan-copy-utils"
import { getDefaultOfferingForProgram } from "@/lib/programs/program-offering-queries"
import { getAllRegistrationOptionsForOffering } from "@/lib/programs/program-registration-option-queries"
import { getProgramById } from "@/lib/programs/program-queries"
import { getAgeGroupLabelsFromMinMax } from "@/lib/programs/program-eligibility-display"
import { normalizeProgramAudienceType } from "@/lib/programs/program-offering-attributes"
import { normalizeProgramKind } from "@/lib/programs/program-kind"
import type { ProgramStatus } from "@/lib/programs/program-status"

type ProgramRow = Record<string, unknown> & {
  id: string
  name: string
  description: string | null
  department_id: string | null
  program_type: "adult" | "youth"
  start_date: string | null
  end_date: string | null
  enrollment_open_date: string | null
  enrollment_close_date: string | null
  grade_levels: string[]
  min_grade: string | null
  max_grade: string | null
  gender: string | null
  min_age: number | null
  max_age: number | null
  capacity: number
  status: string
  visibility: "public" | "private" | "members_only"
  full_program_registration_enabled: boolean
  session_registration_enabled: boolean
  single_session_registration_enabled?: boolean
  drop_in_registration_enabled?: boolean
  enable_waitlist: boolean
  waitlist_capacity: number | null
  financial_assistance_enabled: boolean
  financial_assistance_open: boolean
  financial_assistance_close_date: string | null
  financial_assistance_instructions: string | null
  require_guardian: boolean
  require_grade: boolean
  require_emergency_contact: boolean
  billing_type: "free" | "one_time" | "deposit_balance" | "monthly" | "installments"
  tuition_amount: number
  deposit_amount: number
  monthly_amount: number
  installment_count: number | null
  payment_due_day: number | null
  subtitle?: string | null
  flyer_url?: string | null
  background_color?: string | null
  age_groups?: string[]
  single_session_registration_enabled?: boolean
  drop_in_registration_enabled?: boolean
}

export type ProgramCatalogActionResult =
  | { success: true; programId?: string }
  | { success: false; error: string }

export async function deleteProgram(
  programId: string
): Promise<ProgramCatalogActionResult> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const program = await getProgramById(programId)

  if (!program) {
    return { success: false, error: "Program not found." }
  }

  const [{ count: enrollmentCount }, { count: waitlistCount }] =
    await Promise.all([
      supabase
        .from("program_enrollments")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("program_id", programId),
      supabase
        .from("program_waitlist")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("program_id", programId),
    ])

  if ((enrollmentCount ?? 0) > 0 || (waitlistCount ?? 0) > 0) {
    return {
      success: false,
      error:
        "This program has registrations or waitlist entries and cannot be deleted.",
    }
  }

  const { error } = await supabase
    .from("programs")
    .delete()
    .eq("id", programId)
    .eq("organization_id", organizationId)

  if (error) {
    console.error("[deleteProgram]", error)
    return {
      success: false,
      error: error.message || "Failed to delete program.",
    }
  }

  revalidatePath("/programs/catalog")
  revalidatePath("/programs")

  return { success: true }
}

export async function duplicateProgram(
  sourceProgramId: string
): Promise<ProgramCatalogActionResult> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const { data: source, error: sourceError } = await supabase
    .from("programs")
    .select("*")
    .eq("id", sourceProgramId)
    .eq("organization_id", organizationId)
    .single()

  if (sourceError || !source) {
    return { success: false, error: "Program not found." }
  }

  const sourceProgram = source as ProgramRow
  const duplicateName = buildCopyName(sourceProgram.name)

  try {
    const { programId: newProgramId } = await createProgram({
      name: duplicateName,
      description: sourceProgram.description ?? "",
      department_id: sourceProgram.department_id,
      program_kind: normalizeProgramKind(
        (sourceProgram as { program_kind?: string }).program_kind
      ),
      program_type: normalizeProgramAudienceType(sourceProgram.program_type),
      start_date: null,
      end_date: null,
      enrollment_open_date: null,
      enrollment_close_date: null,
      grade_levels: sourceProgram.grade_levels ?? [],
      min_grade: sourceProgram.min_grade,
      max_grade: sourceProgram.max_grade,
      gender: sourceProgram.gender,
      capacity: sourceProgram.capacity ?? 0,
      status: "draft",
      visibility: sourceProgram.visibility ?? "public",
      full_program_registration_enabled:
        sourceProgram.full_program_registration_enabled ?? true,
      session_registration_enabled:
        sourceProgram.session_registration_enabled ?? false,
      min_age: sourceProgram.min_age,
      max_age: sourceProgram.max_age,
      require_guardian: sourceProgram.require_guardian,
      require_grade: sourceProgram.require_grade,
      require_emergency_contact: sourceProgram.require_emergency_contact,
    })

    await updateProgram({
      id: newProgramId,
      name: duplicateName,
      description: sourceProgram.description ?? "",
      department_id: sourceProgram.department_id,
      start_date: null,
      end_date: null,
      enrollment_open_date: null,
      enrollment_close_date: null,
      age_groups: getAgeGroupLabelsFromMinMax(
        sourceProgram.min_age,
        sourceProgram.max_age
      ),
      grade_levels: sourceProgram.grade_levels ?? [],
      gender: sourceProgram.gender,
      status: "draft",
      program_type: normalizeProgramAudienceType(sourceProgram.program_type),
      min_age: sourceProgram.min_age,
      max_age: sourceProgram.max_age,
      min_grade: sourceProgram.min_grade,
      max_grade: sourceProgram.max_grade,
      require_guardian: sourceProgram.require_guardian,
      require_grade: sourceProgram.require_grade,
      require_emergency_contact: sourceProgram.require_emergency_contact,
      visibility: sourceProgram.visibility ?? "public",
      financial_assistance_enabled:
        sourceProgram.financial_assistance_enabled ?? false,
      financial_assistance_open: sourceProgram.financial_assistance_open ?? false,
      financial_assistance_close_date:
        sourceProgram.financial_assistance_close_date,
      financial_assistance_instructions:
        sourceProgram.financial_assistance_instructions,
      identityAndDefaultsOnly: true,
    })

    await ensureProgramHasOfferingForLegacyCopy({
      organizationId,
      programId: newProgramId,
      programName: duplicateName,
      startDate: null,
      endDate: null,
      enrollmentOpenDate: null,
      enrollmentCloseDate: null,
      programStatus: "draft",
      fullProgramEnabled:
        sourceProgram.full_program_registration_enabled ?? true,
      sessionRegistrationEnabled:
        sourceProgram.session_registration_enabled ?? false,
    })

    const [sourceOffering, newOffering] = await Promise.all([
      getDefaultOfferingForProgram(sourceProgramId),
      getDefaultOfferingForProgram(newProgramId),
    ])

    if (sourceOffering && newOffering) {
      const sourceCapacityGroups = await getOfferingCapacityGroups(
        sourceOffering.id
      )

      if (sourceCapacityGroups.length > 0) {
        await replaceProgramCapacityGroups({
          program_id: newProgramId,
          offering_id: newOffering.id,
          groups: sourceCapacityGroups.map((group) => ({
            name: group.name,
            grade_levels: group.grade_levels || [],
            genders: group.genders || [],
            capacity: group.capacity,
          })),
        })
      }

      const [sourceBundle, sourceOptions, newOptions] = await Promise.all([
        getFeePlanBundleForOffering(sourceOffering.id, organizationId),
        getAllRegistrationOptionsForOffering(sourceOffering.id),
        getAllRegistrationOptionsForOffering(newOffering.id),
      ])

      if (sourceBundle.plans.length > 0) {
        const planInputs = buildFeePlanInputs(sourceBundle)

        await saveOfferingFeePlans({
          programId: newProgramId,
          offeringId: newOffering.id,
          plans: planInputs,
          discountRules: [],
          optionFeePlanLinks: [],
        })

        const newBundle = await getFeePlanBundleForOffering(
          newOffering.id,
          organizationId
        )
        const sourcePlanIdToName = new Map(
          sourceBundle.plans.map((plan) => [plan.id, plan.name])
        )
        const newPlanNameToId = new Map(
          newBundle.plans.map((plan) => [plan.name, plan.id])
        )

        const discountRules = buildDiscountRuleInputs(
          sourceBundle,
          sourcePlanIdToName,
          newPlanNameToId
        )

        if (discountRules.length > 0) {
          await supabase
            .from("program_offering_discount_rules")
            .delete()
            .eq("organization_id", organizationId)
            .eq("offering_id", newOffering.id)

          const { error: discountError } = await supabase
            .from("program_offering_discount_rules")
            .insert(
              discountRules.map((rule) => ({
                organization_id: organizationId,
                offering_id: newOffering.id,
                fee_plan_id: rule.fee_plan_id ?? null,
                rule_type: rule.rule_type,
                label: rule.label.trim(),
                discount_type: rule.discount_type,
                amount: rule.amount,
                conditions: {
                  exclude_component_types:
                    rule.exclude_component_types ?? ["registration_fee"],
                },
                is_active: rule.is_active,
                priority_rank: rule.priority_rank,
              }))
            )

          if (discountError) {
            throw new Error(discountError.message)
          }
        }

        for (const newOption of newOptions) {
          const sourceOption = sourceOptions.find(
            (option) => option.option_type === newOption.option_type
          )
          const sourcePlanName = sourceOption?.fee_plan_id
            ? sourcePlanIdToName.get(sourceOption.fee_plan_id)
            : null
          const mappedPlanId = sourcePlanName
            ? newPlanNameToId.get(sourcePlanName) ?? null
            : null

          if (!sourceOption?.fee_plan_id) {
            continue
          }

          const { error: linkError } = await supabase
            .from("program_registration_options")
            .update({
              fee_plan_id: mappedPlanId,
              updated_at: new Date().toISOString(),
            })
            .eq("organization_id", organizationId)
            .eq("id", newOption.id)

          if (linkError) {
            throw new Error(linkError.message)
          }
        }
      }
    }

    revalidatePath("/programs/catalog")
    revalidatePath("/programs")
    revalidatePath(`/programs/${newProgramId}`)

    return { success: true, programId: newProgramId }
  } catch (error) {
    console.error("[duplicateProgram]", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to duplicate program.",
    }
  }
}

const PROGRAM_STATUS_VALUES: ProgramStatus[] = [
  "draft",
  "active",
  "paused",
  "closed",
  "archived",
]

export async function updateProgramStatus(
  programId: string,
  status: ProgramStatus
): Promise<ProgramCatalogActionResult> {
  if (!PROGRAM_STATUS_VALUES.includes(status)) {
    return { success: false, error: "Invalid program status." }
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("id", programId)
    .eq("organization_id", organizationId)
    .single()

  if (error || !data) {
    return { success: false, error: "Program not found." }
  }

  const program = data as ProgramRow

  if (program.status === status) {
    return { success: true }
  }

  try {
    await updateProgram({
      id: programId,
      name: program.name,
      subtitle: program.subtitle ?? null,
      description: program.description ?? "",
      department_id: program.department_id,
      flyer_url: program.flyer_url ?? null,
      background_color: program.background_color ?? null,
      start_date: program.start_date,
      end_date: program.end_date,
      enrollment_open_date: program.enrollment_open_date,
      enrollment_close_date: program.enrollment_close_date,
      age_groups:
        program.age_groups?.length
          ? program.age_groups
          : getAgeGroupLabelsFromMinMax(program.min_age, program.max_age),
      grade_levels: program.grade_levels ?? [],
      gender: program.gender,
      capacity: program.capacity ?? 0,
      status,
      program_type: program.program_type,
      min_age: program.min_age,
      max_age: program.max_age,
      min_grade: program.min_grade,
      max_grade: program.max_grade,
      require_guardian: program.require_guardian,
      require_grade: program.require_grade,
      require_emergency_contact: program.require_emergency_contact,
      full_program_registration_enabled:
        program.full_program_registration_enabled ?? true,
      session_registration_enabled:
        program.session_registration_enabled ?? false,
      single_session_registration_enabled:
        program.single_session_registration_enabled ?? false,
      drop_in_registration_enabled:
        program.drop_in_registration_enabled ?? false,
      enable_waitlist: program.enable_waitlist ?? false,
      waitlist_capacity: program.waitlist_capacity,
      visibility: program.visibility ?? "public",
      financial_assistance_enabled:
        program.financial_assistance_enabled ?? false,
      financial_assistance_open: program.financial_assistance_open ?? false,
      financial_assistance_close_date: program.financial_assistance_close_date,
      financial_assistance_instructions:
        program.financial_assistance_instructions,
      billing_type: program.billing_type ?? "free",
      tuition_amount: program.tuition_amount ?? 0,
      deposit_amount: program.deposit_amount ?? 0,
      monthly_amount: program.monthly_amount ?? 0,
      installment_count: program.installment_count,
      payment_due_day: program.payment_due_day,
    })

    revalidatePath("/programs/catalog")
    revalidatePath("/programs")
    revalidatePath(`/programs/${programId}`)

    return { success: true }
  } catch (updateError) {
    console.error("[updateProgramStatus]", updateError)
    return {
      success: false,
      error:
        updateError instanceof Error
          ? updateError.message
          : "Failed to update program status.",
    }
  }
}

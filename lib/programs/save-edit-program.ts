"use server"

import { revalidatePath } from "next/cache"

import { replaceProgramCapacityGroups } from "@/lib/programs/program-capacity-group-actions"
import type { ProgramCapacityGroupInput } from "@/lib/programs/program-capacity-group-types"
import {
  getPersistableCapacityGroups,
  normalizeCapacityGroups,
  ADULT_MIN_AGE,
} from "@/lib/programs/program-capacity-group-utils"
import { updateProgram } from "@/lib/programs/program-actions"
import {
  saveOfferingFeePlans,
  type DiscountRuleInput,
  type FeePlanInput,
} from "@/lib/programs/program-fee-plan-actions"
import type { Program } from "@/lib/programs/program-types"

export type SaveEditProgramInput = {
  program: Program
  formData: {
    name: string
    subtitle: string | null
    description: string
    department_id: string | null
    flyer_url: string | null
    background_color: string | null
    start_date: string | null
    end_date: string | null
    enrollment_open_date: string | null
    enrollment_close_date: string | null
    program_type: "adult" | "youth" | "family"
    min_age: number | null
    max_age: number | null
    min_grade: string | null
    max_grade: string | null
    age_groups: string[]
    grade_levels: string[]
    gender: string
    full_program_registration_enabled: boolean
    session_registration_enabled: boolean
    single_session_registration_enabled: boolean
    drop_in_registration_enabled: boolean
    capacity: number
    enable_waitlist: boolean
    waitlist_capacity: number | null
    status: string
    visibility: "public" | "private" | "members_only"
    financial_assistance_enabled: boolean
    financial_assistance_open: boolean
    financial_assistance_close_date: string | null
    financial_assistance_instructions: string | null
  }
  capacityGroups: ProgramCapacityGroupInput[]
  offeringId: string | null
  feePlanState: {
    plans: FeePlanInput[]
    discountRules: DiscountRuleInput[]
    optionFeePlanLinks: Array<{ optionId: string; feePlanId: string | null }>
  } | null
  skipCapacityGroups?: boolean
}

export type SaveEditProgramResult =
  | { success: true; capacityGroups: ProgramCapacityGroupInput[] }
  | { success: false; error: string }

export async function saveEditProgram(
  input: SaveEditProgramInput
): Promise<SaveEditProgramResult> {
  const { program, formData, capacityGroups, offeringId, feePlanState } = input
  const skipCapacityGroups = input.skipCapacityGroups ?? false

  try {
    await updateProgram({
      id: program.id,
      name: formData.name,
      subtitle: formData.subtitle,
      description: formData.description,
      department_id: formData.department_id,
      flyer_url: formData.flyer_url,
      background_color: formData.background_color,
      start_date: formData.start_date,
      end_date: formData.end_date,
      enrollment_open_date: formData.enrollment_open_date,
      enrollment_close_date: formData.enrollment_close_date,

      program_type: formData.program_type,
      min_age: formData.min_age,
      max_age: formData.max_age,
      min_grade: formData.min_grade,
      max_grade: formData.max_grade,
      age_groups: formData.age_groups,
      grade_levels: formData.grade_levels,
      gender: formData.gender,
      require_guardian: formData.program_type !== "adult",
      require_grade: false,
      require_emergency_contact: true,

      full_program_registration_enabled:
        formData.full_program_registration_enabled,
      session_registration_enabled: formData.session_registration_enabled,
      single_session_registration_enabled:
        formData.single_session_registration_enabled,
      drop_in_registration_enabled: formData.drop_in_registration_enabled,

      capacity: formData.capacity,
      enable_waitlist: formData.enable_waitlist,
      waitlist_capacity: formData.waitlist_capacity,
      status: formData.status,
      visibility: formData.visibility,

      billing_type: program.billing_type || "free",
      tuition_amount: program.tuition_amount || 0,
      deposit_amount: program.deposit_amount || 0,
      monthly_amount: program.monthly_amount || 0,
      installment_count: program.installment_count ?? null,
      payment_due_day: program.payment_due_day ?? null,

      financial_assistance_enabled: formData.financial_assistance_enabled,
      financial_assistance_open: formData.financial_assistance_open,
      financial_assistance_close_date: formData.financial_assistance_close_date,
      financial_assistance_instructions:
        formData.financial_assistance_instructions,
    })

    const shouldPersistCapacityGroups =
      !skipCapacityGroups &&
      (formData.min_age == null || formData.min_age < ADULT_MIN_AGE)

    const persistedCapacityGroups = shouldPersistCapacityGroups
      ? getPersistableCapacityGroups(capacityGroups, formData.grade_levels)
      : []

    const savedCapacityGroups = skipCapacityGroups
      ? []
      : await replaceProgramCapacityGroups({
          program_id: program.id,
          groups: persistedCapacityGroups,
        })

    const normalizedCapacityGroups = skipCapacityGroups
      ? normalizeCapacityGroups(capacityGroups, formData.grade_levels)
      : normalizeCapacityGroups(savedCapacityGroups, formData.grade_levels)

    if (offeringId && feePlanState) {
      await saveOfferingFeePlans({
        programId: program.id,
        offeringId,
        plans: feePlanState.plans,
        discountRules: feePlanState.discountRules,
        optionFeePlanLinks: feePlanState.optionFeePlanLinks,
      })
    }

    revalidatePath(`/programs/${program.id}/edit`)
    revalidatePath("/programs/catalog")

    return { success: true, capacityGroups: normalizedCapacityGroups }
  } catch (error) {
    console.error("[saveEditProgram]", error)

    const message =
      error instanceof Error
        ? error.message
        : "Failed to save program. Please try again."

    if (message.includes("program_offering_fee_plans_default_idx")) {
      return {
        success: false,
        error:
          "Could not save pricing because multiple default fee plans were detected. Open the offering Pricing subtab, ensure only one fee plan is marked default, and save again.",
      }
    }

    return {
      success: false,
      error: message,
    }
  }
}

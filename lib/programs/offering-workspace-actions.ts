"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { replaceProgramCapacityGroups } from "@/lib/programs/program-capacity-group-actions"
import type { ProgramCapacityGroupInput } from "@/lib/programs/program-capacity-group-types"
import { getTotalCapacityFromGroups } from "@/lib/programs/program-capacity-group-types"
import {
  getPersistableCapacityGroups,
  normalizeCapacityGroups,
} from "@/lib/programs/program-capacity-group-utils"
import {
  saveOfferingFeePlans,
  type DiscountRuleInput,
  type FeePlanInput,
} from "@/lib/programs/program-fee-plan-actions"
import { syncRegistrationOptionsFromProgramFlags } from "@/lib/programs/program-registration-option-actions"
import { getAllRegistrationOptionsForOffering } from "@/lib/programs/program-registration-option-queries"
import type { ProgramRegistrationOption } from "@/lib/programs/program-registration-option-types"
import { getAgeGroupLabelsFromMinMax } from "@/lib/programs/program-eligibility-display"
import { getMinMaxGradeFromLevels } from "@/lib/programs/grade-levels"

function inferProgramTypeFromMinAge(
  minAge: number | null
): "adult" | "youth" {
  return minAge !== null && minAge >= 18 ? "adult" : "youth"
}

function usesYouthCapacityGroups(minAge: number | null) {
  return inferProgramTypeFromMinAge(minAge) === "youth"
}

function revalidateOfferingPaths(programId: string) {
  revalidatePath(`/programs/${programId}/edit`)
  revalidatePath(`/programs/${programId}/sessions`)
  revalidatePath(`/programs/${programId}/billing`)
  revalidatePath("/programs/settings")
  revalidatePath("/customer/programs")
  revalidatePath(`/customer/programs/${programId}`)
  revalidatePath(`/customer/programs/${programId}/register`)
}

export async function saveOfferingSiblingDiscountRules(input: {
  programId: string
  offeringId: string
  rules: DiscountRuleInput[]
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const siblingRules = input.rules.filter((rule) => rule.rule_type === "sibling")

  const { error: deleteError } = await supabase
    .from("program_offering_discount_rules")
    .delete()
    .eq("organization_id", organizationId)
    .eq("offering_id", input.offeringId)
    .eq("rule_type", "sibling")

  if (deleteError) {
    console.error("[saveOfferingSiblingDiscountRules]", deleteError)
    throw new Error("Failed to update sibling discount rules.")
  }

  if (siblingRules.length > 0) {
    const { error: insertError } = await supabase
      .from("program_offering_discount_rules")
      .insert(
        siblingRules.map((rule) => ({
          organization_id: organizationId,
          offering_id: input.offeringId,
          fee_plan_id: rule.fee_plan_id ?? null,
          rule_type: rule.rule_type,
          label: rule.label.trim(),
          discount_type: rule.discount_type,
          amount: rule.amount,
          conditions: {
            exclude_component_types: rule.exclude_component_types ?? [
              "registration_fee",
            ],
          },
          is_active: rule.is_active,
          priority_rank: rule.priority_rank,
        }))
      )

    if (insertError) {
      console.error("[saveOfferingSiblingDiscountRules]", insertError)
      throw new Error("Failed to save sibling discount rules.")
    }
  }

  revalidateOfferingPaths(input.programId)
}

export async function saveProgramWaitlistSettings(input: {
  programId: string
  enable_waitlist: boolean
  waitlist_capacity: number | null
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("programs")
    .update({
      enable_waitlist: input.enable_waitlist,
      waitlist_capacity: input.waitlist_capacity,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.programId)
    .eq("organization_id", organizationId)

  if (error) {
    console.error("[saveProgramWaitlistSettings]", error)
    throw new Error("Failed to save waitlist settings.")
  }

  revalidateOfferingPaths(input.programId)
}

export async function saveOfferingRegistrationPanel(input: {
  programId: string
  offeringId: string
  organizationId: string
  min_age: number | null
  max_age: number | null
  grade_levels: string[]
  gender: string
  enrollment_open_date: string | null
  enrollment_close_date: string | null
  fullProgramEnabled: boolean
  sessionRegistrationEnabled: boolean
  singleSessionEnabled: boolean
  dropInEnabled: boolean
  capacity: number
  capacityGroups: ProgramCapacityGroupInput[]
  enable_waitlist: boolean
  waitlist_capacity: number | null
}): Promise<ProgramRegistrationOption[]> {
  if (
    input.min_age !== null &&
    input.max_age !== null &&
    input.min_age > input.max_age
  ) {
    throw new Error("Minimum age cannot be greater than maximum age.")
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  if (input.organizationId !== organizationId) {
    throw new Error("Organization mismatch while saving registration settings.")
  }

  const programType = inferProgramTypeFromMinAge(input.min_age)
  const gradeLevels = programType === "adult" ? [] : input.grade_levels
  const { minGrade, maxGrade } =
    programType === "adult"
      ? { minGrade: null, maxGrade: null }
      : getMinMaxGradeFromLevels(gradeLevels)

  let resolvedCapacity = Math.max(0, Number(input.capacity || 0))

  if (usesYouthCapacityGroups(input.min_age)) {
    const persistableGroups = getPersistableCapacityGroups(
      normalizeCapacityGroups(input.capacityGroups, gradeLevels),
      gradeLevels
    )

    await replaceProgramCapacityGroups({
      program_id: input.programId,
      groups: persistableGroups,
    })

    resolvedCapacity =
      persistableGroups.length > 0
        ? getTotalCapacityFromGroups(persistableGroups)
        : Math.max(0, Number(input.capacity || 0))
  }

  const { error } = await supabase
    .from("programs")
    .update({
      min_age: input.min_age,
      max_age: input.max_age,
      grade_levels: gradeLevels,
      min_grade: minGrade,
      max_grade: maxGrade,
      gender: input.gender || "All",
      program_type: programType,
      age_groups: getAgeGroupLabelsFromMinMax(input.min_age, input.max_age),
      require_guardian: programType !== "adult",
      enrollment_open_date: input.enrollment_open_date || null,
      enrollment_close_date: input.enrollment_close_date || null,
      capacity: resolvedCapacity,
      enable_waitlist: input.enable_waitlist,
      waitlist_capacity: input.waitlist_capacity,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.programId)
    .eq("organization_id", organizationId)

  if (error) {
    console.error("[saveOfferingRegistrationPanel]", error)
    throw new Error("Failed to save eligibility and enrollment settings.")
  }

  await syncRegistrationOptionsFromProgramFlags({
    organizationId,
    programId: input.programId,
    offeringId: input.offeringId,
    fullProgramEnabled: input.fullProgramEnabled,
    sessionRegistrationEnabled: input.sessionRegistrationEnabled,
    singleSessionEnabled: input.singleSessionEnabled,
    dropInEnabled: input.dropInEnabled,
  })

  const { data: offeringRow } = await supabase
    .from("program_offerings")
    .select("is_default")
    .eq("id", input.offeringId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (offeringRow?.is_default) {
    const { error: programFlagsError } = await supabase
      .from("programs")
      .update({
        full_program_registration_enabled: input.fullProgramEnabled,
        session_registration_enabled: input.sessionRegistrationEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.programId)
      .eq("organization_id", organizationId)

    if (programFlagsError) {
      console.error("[saveOfferingRegistrationPanel] program flags:", programFlagsError)
      throw new Error("Failed to save registration type settings.")
    }
  }

  revalidateOfferingPaths(input.programId)

  return getAllRegistrationOptionsForOffering(input.offeringId)
}

export async function saveOfferingRegistrationOptions(input: {
  programId: string
  offeringId: string
  organizationId: string
  fullProgramEnabled: boolean
  sessionRegistrationEnabled: boolean
  singleSessionEnabled: boolean
  dropInEnabled: boolean
}) {
  await syncRegistrationOptionsFromProgramFlags({
    organizationId: input.organizationId,
    programId: input.programId,
    offeringId: input.offeringId,
    fullProgramEnabled: input.fullProgramEnabled,
    sessionRegistrationEnabled: input.sessionRegistrationEnabled,
    singleSessionEnabled: input.singleSessionEnabled,
    dropInEnabled: input.dropInEnabled,
  })

  revalidateOfferingPaths(input.programId)
}

export async function saveOfferingPricing(input: {
  programId: string
  offeringId: string
  plans: FeePlanInput[]
  discountRules: DiscountRuleInput[]
  optionFeePlanLinks: Array<{ optionId: string; feePlanId: string | null }>
}) {
  await saveOfferingFeePlans({
    programId: input.programId,
    offeringId: input.offeringId,
    plans: input.plans,
    discountRules: input.discountRules,
    optionFeePlanLinks: input.optionFeePlanLinks,
  })

  revalidateOfferingPaths(input.programId)
}

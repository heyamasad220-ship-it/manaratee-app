"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getOfferingWorkspaceDataForProgram } from "@/lib/programs/offering-workspace-queries"
import { getOfferingsForProgram } from "@/lib/programs/program-offering-queries"
import type { OfferingWorkspaceDataMap } from "@/lib/programs/offering-workspace-types"
import {
  replaceProgramCapacityGroups,
  syncProgramCapacityFromOfferings,
} from "@/lib/programs/program-capacity-group-actions"
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
import { getMinMaxGradeFromLevels } from "@/lib/programs/grade-levels"
import {
  deriveCapacityMode,
  deriveRegistrationMode,
} from "@/lib/programs/program-offering-attributes"

function inferProgramTypeFromMinAge(
  minAge: number | null
): "adult" | "youth" {
  return minAge !== null && minAge >= 18 ? "adult" : "youth"
}

function usesYouthCapacityGroups(minAge: number | null) {
  return inferProgramTypeFromMinAge(minAge) === "youth"
}

function revalidateOfferingPaths(programId: string) {
  revalidatePath(`/programs/${programId}`)
  revalidatePath(`/programs/${programId}/offerings`)
  revalidatePath(`/programs/${programId}/sessions`)
  revalidatePath(`/programs/${programId}/billing`)
  revalidatePath("/workforce?tab=departments")
  revalidatePath("/customer/programs")
  revalidatePath(`/customer/programs/${programId}`)
  revalidatePath(`/customer/programs/${programId}/register`)
}

/** Lazy-load offering workspace bundles for the offerings workspace. */
export async function loadOfferingWorkspaceDataForProgramAction(
  programId: string
): Promise<OfferingWorkspaceDataMap> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return {}
  }

  const offerings = await getOfferingsForProgram(programId)
  return getOfferingWorkspaceDataForProgram(programId, organizationId, offerings)
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

export async function saveOfferingWaitlistSettings(input: {
  programId: string
  offeringId: string
  enable_waitlist: boolean
  waitlist_capacity: number | null
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("program_offerings")
    .update({
      enable_waitlist: input.enable_waitlist,
      waitlist_capacity: input.waitlist_capacity,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.offeringId)
    .eq("program_id", input.programId)
    .eq("organization_id", organizationId)

  if (error) {
    console.error("[saveOfferingWaitlistSettings]", error)
    throw new Error("Failed to save waitlist settings.")
  }

  revalidateOfferingPaths(input.programId)
}

/** @deprecated Use saveOfferingWaitlistSettings (S4). */
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

  const { data: offering } = await supabase
    .from("program_offerings")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("program_id", input.programId)
    .eq("is_default", true)
    .maybeSingle()

  if (!offering?.id) {
    throw new Error("No offering found. Configure waitlist on an offering.")
  }

  await saveOfferingWaitlistSettings({
    programId: input.programId,
    offeringId: offering.id as string,
    enable_waitlist: input.enable_waitlist,
    waitlist_capacity: input.waitlist_capacity,
  })
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
  /** false = Register & pay immediately (no Apply/Approve). */
  application_required?: boolean
  inherit_dates?: boolean
  inherit_eligibility?: boolean
  inherit_enrollment?: boolean
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
      offering_id: input.offeringId,
      groups: persistableGroups,
    })

    resolvedCapacity =
      persistableGroups.length > 0
        ? getTotalCapacityFromGroups(persistableGroups)
        : Math.max(0, Number(input.capacity || 0))
  }

  const capacityMode = deriveCapacityMode(resolvedCapacity)
  const registrationMode = deriveRegistrationMode({
    fullProgramEnabled: input.fullProgramEnabled,
    sessionRegistrationEnabled:
      input.sessionRegistrationEnabled ||
      input.singleSessionEnabled ||
      input.dropInEnabled,
  })

  // S4: offering is SSOT for eligibility / capacity / registration mode.
  const { error: offeringError } = await supabase
    .from("program_offerings")
    .update({
      audience_type: programType,
      min_age: input.min_age,
      max_age: input.max_age,
      grade_levels: gradeLevels,
      min_grade: minGrade,
      max_grade: maxGrade,
      gender: input.gender || "All",
      require_guardian: programType !== "adult",
      capacity_mode: capacityMode,
      capacity: capacityMode === "limited" ? resolvedCapacity : null,
      enable_waitlist: input.enable_waitlist,
      waitlist_capacity: input.waitlist_capacity,
      registration_mode: registrationMode,
      application_required: input.application_required !== false,
      enrollment_open_date: input.enrollment_open_date || null,
      enrollment_close_date: input.enrollment_close_date || null,
      inherit_dates: input.inherit_dates ?? false,
      inherit_eligibility: input.inherit_eligibility ?? false,
      inherit_enrollment: input.inherit_enrollment ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.offeringId)
    .eq("organization_id", organizationId)

  if (offeringError) {
    console.error("[saveOfferingRegistrationPanel] offering:", offeringError)
    throw new Error("Failed to save offering registration settings.")
  }

  // Catalog dual-read: program.capacity = sum of limited offerings.
  await syncProgramCapacityFromOfferings(organizationId, input.programId)

  await syncRegistrationOptionsFromProgramFlags({
    organizationId,
    programId: input.programId,
    offeringId: input.offeringId,
    fullProgramEnabled: input.fullProgramEnabled,
    sessionRegistrationEnabled: input.sessionRegistrationEnabled,
    singleSessionEnabled: input.singleSessionEnabled,
    dropInEnabled: input.dropInEnabled,
  })

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

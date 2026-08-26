"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { copyOfferingCapacityGroups } from "@/lib/programs/program-capacity-group-actions"
import { copyOfferingScheduleItems } from "@/lib/programs/program-schedule-actions"
import { getOfferingBillingPeriods } from "@/lib/programs/program-billing-queries"
import { saveOfferingFeePlans } from "@/lib/programs/program-fee-plan-actions"
import {
  adaptCopiedFeePlanName,
  buildCopyName,
  buildDiscountRuleInputs,
  buildFeePlanInputs,
} from "@/lib/programs/program-fee-plan-copy-utils"
import { getFeePlanBundleForOffering } from "@/lib/programs/program-fee-plan-queries"
import { getAllRegistrationOptionsForOffering } from "@/lib/programs/program-registration-option-queries"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import { getProgramSessionsForOffering } from "@/lib/programs/program-session-queries"

function revalidateOfferingPaths(programId: string) {
  revalidatePath("/programs/catalog")
  revalidatePath(`/programs/${programId}`)
  revalidatePath(`/programs/${programId}/offerings`)
  revalidatePath(`/programs/${programId}/sessions`)
  revalidatePath(`/programs/${programId}/billing`)
  revalidatePath(`/customer/programs/${programId}`)
  revalidatePath(`/customer/programs/${programId}/register`)
}

async function copyOfferingPricing(
  programId: string,
  sourceOfferingId: string,
  newOfferingId: string,
  organizationId: string,
  sourceOfferingName: string,
  newOfferingName: string
) {
  const supabase = await createClient()

  const [sourceBundle, sourceOptions] = await Promise.all([
    getFeePlanBundleForOffering(sourceOfferingId, organizationId),
    getAllRegistrationOptionsForOffering(sourceOfferingId),
  ])

  let sourcePlanIdToName = new Map<string, string>()
  let newPlanNameToId = new Map<string, string>()

  if (sourceBundle.plans.length > 0) {
    const planInputs = buildFeePlanInputs(sourceBundle).map((plan) => ({
      ...plan,
      name: adaptCopiedFeePlanName(
        plan.name,
        sourceOfferingName,
        newOfferingName
      ),
    }))

    await saveOfferingFeePlans({
      programId,
      offeringId: newOfferingId,
      plans: planInputs,
      discountRules: [],
      optionFeePlanLinks: [],
    })

    const newBundle = await getFeePlanBundleForOffering(newOfferingId, organizationId)
    sourcePlanIdToName = new Map(
      sourceBundle.plans.map((plan) => [plan.id, plan.name])
    )
    newPlanNameToId = new Map(
      newBundle.plans.map((plan) => [plan.name, plan.id])
    )

    const discountRules = buildDiscountRuleInputs(
      sourceBundle,
      sourcePlanIdToName,
      newPlanNameToId
    )

    if (discountRules.length > 0) {
      const { error: deleteError } = await supabase
        .from("program_offering_discount_rules")
        .delete()
        .eq("organization_id", organizationId)
        .eq("offering_id", newOfferingId)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      const { error: discountError } = await supabase
        .from("program_offering_discount_rules")
        .insert(
          discountRules.map((rule) => ({
            organization_id: organizationId,
            offering_id: newOfferingId,
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
  }

  for (const sourceOption of sourceOptions) {
    const sourcePlanName = sourceOption.fee_plan_id
      ? sourcePlanIdToName.get(sourceOption.fee_plan_id)
      : null
    const mappedPlanId = sourcePlanName
      ? newPlanNameToId.get(sourcePlanName) ?? null
      : null

    const { error } = await supabase.from("program_registration_options").insert({
      organization_id: organizationId,
      program_id: programId,
      offering_id: newOfferingId,
      name: sourceOption.name,
      option_type: sourceOption.option_type,
      is_active: sourceOption.is_active,
      priority_rank: sourceOption.priority_rank,
      available_from: sourceOption.available_from,
      available_until: sourceOption.available_until,
      fee_plan_id: mappedPlanId,
    })

    if (error) {
      throw new Error(error.message)
    }
  }
}

export async function duplicateProgramOffering(
  sourceOfferingId: string,
  newName?: string
): Promise<ProgramOffering> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: source, error: sourceError } = await supabase
    .from("program_offerings")
    .select("*")
    .eq("id", sourceOfferingId)
    .eq("organization_id", organizationId)
    .single()

  if (sourceError || !source) {
    throw new Error("Offering not found")
  }

  const name = (newName ?? buildCopyName(source.name as string)).trim()
  if (!name) {
    throw new Error("Offering name is required")
  }

  const programId = source.program_id as string
  const offeringStatus =
    source.status === "archived" || source.status === "cancelled"
      ? "draft"
      : (source.status as string)

  const sortOrder = await (async () => {
    const { data: maxRow } = await supabase
      .from("program_offerings")
      .select("sort_order")
      .eq("organization_id", organizationId)
      .eq("program_id", programId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle()
    return Number(maxRow?.sort_order || 0) + 10
  })()

  const { data: created, error: createError } = await supabase
    .from("program_offerings")
    .insert({
      organization_id: organizationId,
      program_id: programId,
      name,
      is_default: false,
      offering_type: source.offering_type,
      start_date: source.start_date,
      end_date: source.end_date,
      enrollment_open_date: source.enrollment_open_date,
      enrollment_close_date: source.enrollment_close_date,
      status: offeringStatus,
      sort_order: sortOrder,
      inherit_dates: source.inherit_dates ?? false,
      inherit_eligibility: source.inherit_eligibility ?? false,
      inherit_enrollment: source.inherit_enrollment ?? false,
      audience_type: source.audience_type ?? "youth",
      min_age: source.min_age ?? null,
      max_age: source.max_age ?? null,
      min_grade: source.min_grade ?? null,
      max_grade: source.max_grade ?? null,
      grade_levels: source.grade_levels ?? [],
      gender: source.gender ?? null,
      require_guardian: source.require_guardian ?? false,
      require_grade: source.require_grade ?? false,
      require_emergency_contact: source.require_emergency_contact ?? true,
      capacity_mode: source.capacity_mode ?? "unlimited",
      capacity: source.capacity ?? null,
      enable_waitlist: source.enable_waitlist ?? false,
      waitlist_capacity: source.waitlist_capacity ?? null,
      selected_sessions_open: source.selected_sessions_open !== false,
      waitlist_offer_deadline_days: source.waitlist_offer_deadline_days ?? null,
      waitlist_offer_deadline_days: source.waitlist_offer_deadline_days ?? null,
      registration_mode: source.registration_mode ?? "required",
      attendance_tracked: source.attendance_tracked ?? false,
      care_enabled: source.care_enabled ?? false,
      delivery_format: source.delivery_format ?? "in_person",
    })
    .select("*")
    .single()

  if (createError || !created) {
    console.error("duplicateProgramOffering insert:", createError)
    throw new Error(createError?.message || "Failed to create offering copy")
  }

  const newOfferingId = created.id as string

  try {
    await copyOfferingPricing(
      programId,
      sourceOfferingId,
      newOfferingId,
      organizationId,
      source.name as string,
      name
    )

    await copyOfferingCapacityGroups({
      organizationId,
      programId,
      sourceOfferingId,
      targetOfferingId: newOfferingId,
    })

    await copyOfferingScheduleItems({
      organizationId,
      programId,
      sourceOfferingId,
      targetOfferingId: newOfferingId,
    })

    const [sourceSessions, billingPeriods] = await Promise.all([
      getProgramSessionsForOffering(
        programId,
        sourceOfferingId,
        source.is_default === true
      ),
      getOfferingBillingPeriods(organizationId, sourceOfferingId),
    ])

    if (sourceSessions.length > 0) {
      const { error: sessionsError } = await supabase
        .from("program_sessions")
        .insert(
          sourceSessions.map((session, index) => ({
            organization_id: organizationId,
            program_id: programId,
            offering_id: newOfferingId,
            name: session.name,
            description: session.description,
            start_date: session.start_date,
            end_date: session.end_date,
            registration_open_date: session.registration_open_date,
            registration_close_date: session.registration_close_date,
            capacity: session.capacity ?? 0,
            enrolled: 0,
            waitlist: 0,
            enable_waitlist: session.enable_waitlist ?? false,
            waitlist_capacity: session.waitlist_capacity,
            price: session.price ?? 0,
            status: session.status ?? "active",
            sort_order: session.sort_order ?? index,
          }))
        )

      if (sessionsError) {
        throw new Error(sessionsError.message)
      }
    }

    if (billingPeriods.length > 0) {
      const { error: billingError } = await supabase
        .from("program_offering_billing_periods")
        .insert(
          billingPeriods.map((period) => ({
            organization_id: organizationId,
            program_id: programId,
            offering_id: newOfferingId,
            period_key: period.period_key,
            period_label: period.period_label,
            period_start: period.period_start,
            period_end: period.period_end,
            due_date: period.due_date,
            sequence_number: period.sequence_number,
            default_tuition_amount: period.default_tuition_amount,
            period_status: period.period_status,
            admin_notes: period.admin_notes,
          }))
        )

      if (billingError) {
        throw new Error(billingError.message)
      }
    }
  } catch (error) {
    await supabase
      .from("program_offerings")
      .delete()
      .eq("id", newOfferingId)
      .eq("organization_id", organizationId)

    throw error
  }

  revalidateOfferingPaths(programId)

  return created as ProgramOffering
}

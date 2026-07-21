"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import type {
  DiscountRuleType,
  DiscountType,
  FeeComponentType,
  FeePlanType,
  FeePricingModel,
  FeeQuantityMode,
} from "@/lib/programs/program-fee-plan-types"

export type FeePlanComponentInput = {
  id?: string
  component_type: FeeComponentType
  label: string
  amount: number
  pricing_model: FeePricingModel
  quantity_mode: FeeQuantityMode
  quantity_value: number
  addon_key?: string | null
  session_price_source?: "component" | "session_table"
  applies_to_option_types?: string[] | null
  sort_order: number
  is_active: boolean
}

export type DiscountRuleInput = {
  id?: string
  rule_type: DiscountRuleType
  label: string
  discount_type: DiscountType
  amount: number
  fee_plan_id?: string | null
  is_active: boolean
  priority_rank: number
  exclude_component_types?: string[]
}

export type FeePlanInput = {
  id?: string
  name: string
  plan_type: FeePlanType
  is_default: boolean
  is_active: boolean
  deposit_amount: number
  payment_due_day: number | null
  installment_count: number | null
  notes?: string | null
  components: FeePlanComponentInput[]
}

function normalizePaymentDueDay(
  planType: FeePlanType,
  value: number | null | undefined
): number | null {
  if (planType !== "monthly") {
    return null
  }

  if (value == null || Number.isNaN(Number(value))) {
    return null
  }

  const day = Math.round(Number(value))

  if (day < 1 || day > 28) {
    throw new Error("Payment Due Day must be between 1 and 28 for monthly fee plans.")
  }

  return day
}

function normalizeInstallmentCount(
  planType: FeePlanType,
  value: number | null | undefined
): number | null {
  if (planType !== "installments") {
    return null
  }

  if (value == null || Number.isNaN(Number(value))) {
    return null
  }

  const count = Math.round(Number(value))

  if (count < 1) {
    throw new Error("Installment Count must be at least 1 for installment fee plans.")
  }

  return count
}

function normalizePlanForSave(plan: FeePlanInput): FeePlanInput {
  return {
    ...plan,
    payment_due_day: normalizePaymentDueDay(plan.plan_type, plan.payment_due_day),
    installment_count: normalizeInstallmentCount(
      plan.plan_type,
      plan.installment_count
    ),
  }
}

function normalizeDefaultFeePlans(plans: FeePlanInput[]) {
  if (plans.length === 0) {
    return plans
  }

  const defaultIndex = plans.findIndex((plan) => plan.is_default)

  return plans.map((plan, index) => ({
    ...plan,
    is_default: defaultIndex >= 0 ? index === defaultIndex : index === 0,
  }))
}

function resolveExistingPlanId(
  plan: FeePlanInput,
  existingPlans: Array<{ id: string; name: string; is_default: boolean }>
) {
  if (plan.id) {
    return plan.id
  }

  if (existingPlans.length === 0) {
    return null
  }

  const nameMatch = existingPlans.find(
    (existing) => existing.name.trim() === plan.name.trim()
  )

  if (nameMatch) {
    return nameMatch.id
  }

  if (plan.is_default) {
    const defaultMatch = existingPlans.find((existing) => existing.is_default)
    if (defaultMatch) {
      return defaultMatch.id
    }
  }

  if (existingPlans.length === 1) {
    return existingPlans[0].id
  }

  return null
}

export async function saveOfferingFeePlans(input: {
  programId: string
  offeringId: string
  plans: FeePlanInput[]
  discountRules: DiscountRuleInput[]
  optionFeePlanLinks: Array<{ optionId: string; feePlanId: string | null }>
}) {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) throw new Error("No organization selected")

  const supabase = await createClient()
  const keptPlanIds: string[] = []
  const planIdBySourceKey = new Map<string, string>()
  const plans = normalizeDefaultFeePlans(
    input.plans
      .filter((plan) => plan.name.trim())
      .map(normalizePlanForSave)
  )

  for (const plan of plans) {
    if (plan.plan_type === "monthly" && plan.payment_due_day == null) {
      throw new Error(
        "Monthly fee plans require a Payment Due Day between 1 and 28."
      )
    }
  }

  if (plans.length === 0) {
    return
  }

  const { data: existingPlans, error: existingPlansError } = await supabase
    .from("program_offering_fee_plans")
    .select("id, name, is_default")
    .eq("organization_id", organizationId)
    .eq("offering_id", input.offeringId)

  if (existingPlansError) {
    throw new Error(existingPlansError.message)
  }

  const existingPlanRows = (existingPlans || []) as Array<{
    id: string
    name: string
    is_default: boolean
  }>

  const { error: clearDefaultError } = await supabase
    .from("program_offering_fee_plans")
    .update({
      is_default: false,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("offering_id", input.offeringId)

  if (clearDefaultError) {
    throw new Error(clearDefaultError.message)
  }

  for (let index = 0; index < plans.length; index++) {
    const plan = plans[index]
    const planPayload = {
      organization_id: organizationId,
      program_id: input.programId,
      offering_id: input.offeringId,
      name: plan.name.trim(),
      plan_type: plan.plan_type,
      is_default: plan.is_default,
      is_active: plan.is_active,
      deposit_amount: plan.deposit_amount,
      payment_due_day: plan.payment_due_day,
      installment_count: plan.installment_count,
      notes: plan.notes ?? null,
      updated_at: new Date().toISOString(),
    }

    let planId = resolveExistingPlanId(plan, existingPlanRows)

    if (planId) {
      const { error } = await supabase
        .from("program_offering_fee_plans")
        .update({
          ...planPayload,
          is_default: false,
        })
        .eq("organization_id", organizationId)
        .eq("id", planId)

      if (error) throw new Error(error.message)

      await supabase
        .from("program_offering_fee_plan_components")
        .delete()
        .eq("organization_id", organizationId)
        .eq("fee_plan_id", planId)
    } else {
      const { data, error } = await supabase
        .from("program_offering_fee_plans")
        .insert({
          ...planPayload,
          is_default: false,
        })
        .select("id")
        .single()

      if (error) throw new Error(error.message)
      planId = data.id as string
    }

    keptPlanIds.push(planId)

    for (const sourceKey of [plan.id, `draft-${index}`].filter(Boolean) as string[]) {
      planIdBySourceKey.set(sourceKey, planId)
    }

    if (plan.is_default) {
      const { error } = await supabase
        .from("program_offering_fee_plans")
        .update({
          is_default: true,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organizationId)
        .eq("id", planId)

      if (error) throw new Error(error.message)
    }

    const componentRows = plan.components
      .filter((component) => component.label.trim())
      .map((component, index) => ({
        organization_id: organizationId,
        fee_plan_id: planId,
        component_type: component.component_type,
        label: component.label.trim(),
        amount: component.amount,
        pricing_model: component.pricing_model,
        quantity_mode: component.quantity_mode,
        quantity_value: component.quantity_value,
        addon_key: component.addon_key ?? null,
        session_price_source: component.session_price_source ?? "session_table",
        applies_to_option_types: component.applies_to_option_types ?? null,
        sort_order: component.sort_order ?? index * 10,
        is_active: component.is_active,
      }))

    if (componentRows.length > 0) {
      const { error } = await supabase
        .from("program_offering_fee_plan_components")
        .insert(componentRows)

      if (error) throw new Error(error.message)
    }
  }

  const { data: currentOfferingPlans } = await supabase
    .from("program_offering_fee_plans")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("offering_id", input.offeringId)

  const removeIds = (currentOfferingPlans || [])
    .map((row) => row.id as string)
    .filter((id) => !keptPlanIds.includes(id))

  if (removeIds.length > 0) {
    await supabase
      .from("program_offering_fee_plans")
      .delete()
      .eq("organization_id", organizationId)
      .in("id", removeIds)
  }

  await supabase
    .from("program_offering_discount_rules")
    .delete()
    .eq("organization_id", organizationId)
    .eq("offering_id", input.offeringId)

  if (input.discountRules.length > 0) {
    const { error } = await supabase.from("program_offering_discount_rules").insert(
      input.discountRules.map((rule) => ({
        organization_id: organizationId,
        offering_id: input.offeringId,
        fee_plan_id: rule.fee_plan_id ?? null,
        rule_type: rule.rule_type,
        label: rule.label.trim(),
        discount_type: rule.discount_type,
        amount: rule.amount,
        conditions: {
          exclude_component_types: rule.exclude_component_types ?? ["registration_fee"],
        },
        is_active: rule.is_active,
        priority_rank: rule.priority_rank,
      }))
    )

    if (error) throw new Error(error.message)
  }

  for (const link of input.optionFeePlanLinks) {
    const resolvedFeePlanId = link.feePlanId
      ? planIdBySourceKey.get(link.feePlanId) ??
        (keptPlanIds.includes(link.feePlanId) ? link.feePlanId : null)
      : null

    if (link.feePlanId && !resolvedFeePlanId) {
      throw new Error(
        `Registration option ${link.optionId} references an invalid fee plan. Save fee plans first, then link options.`
      )
    }

    const { error } = await supabase
      .from("program_registration_options")
      .update({
        fee_plan_id: resolvedFeePlanId,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", link.optionId)

    if (error) throw new Error(error.message)
  }

  revalidatePath(`/programs/${input.programId}`)
  revalidatePath(`/programs/${input.programId}/offerings`)
  revalidatePath(`/customer/programs/${input.programId}/register`)
}

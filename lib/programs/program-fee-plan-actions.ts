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

  for (const plan of input.plans) {
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

    let planId = plan.id

    if (planId) {
      const { error } = await supabase
        .from("program_offering_fee_plans")
        .update(planPayload)
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
        .insert(planPayload)
        .select("id")
        .single()

      if (error) throw new Error(error.message)
      planId = data.id as string
    }

    keptPlanIds.push(planId)

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

  const { data: existingPlans } = await supabase
    .from("program_offering_fee_plans")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("offering_id", input.offeringId)

  const removeIds = (existingPlans || [])
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
    if (link.feePlanId) {
      const planExists = keptPlanIds.includes(link.feePlanId)
      if (!planExists) {
        throw new Error(
          `Registration option ${link.optionId} references an invalid fee plan. Save fee plans first, then link options.`
        )
      }
    }

    const { error } = await supabase
      .from("program_registration_options")
      .update({ fee_plan_id: link.feePlanId, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", link.optionId)

    if (error) throw new Error(error.message)
  }

  revalidatePath(`/programs/${input.programId}/edit`)
  revalidatePath(`/customer/programs/${input.programId}/register`)
}

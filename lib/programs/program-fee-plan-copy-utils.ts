import type { DiscountRuleInput, FeePlanInput } from "@/lib/programs/program-fee-plan-actions"
import type { getFeePlanBundleForOffering } from "@/lib/programs/program-fee-plan-queries"

export function buildCopyName(name: string) {
  const copySuffix = " (Copy)"
  if (name.endsWith(copySuffix)) {
    return `${name.slice(0, -copySuffix.length)} (Copy 2)`
  }

  return `${name}${copySuffix}`
}

export function adaptCopiedFeePlanName(
  planName: string,
  sourceOfferingName: string,
  newOfferingName: string
) {
  const source = sourceOfferingName.trim()
  const target = newOfferingName.trim()

  if (!source || !target || source === target) {
    return planName
  }

  if (planName.includes(source)) {
    return planName.replace(source, target)
  }

  return planName
}

export function buildFeePlanInputs(
  bundle: Awaited<ReturnType<typeof getFeePlanBundleForOffering>>
): FeePlanInput[] {
  return bundle.plans.map((plan) => ({
    name: plan.name,
    plan_type: plan.plan_type,
    is_default: plan.is_default,
    is_active: plan.is_active,
    deposit_amount: plan.deposit_amount,
    payment_due_day: plan.payment_due_day,
    installment_count: plan.installment_count,
    notes: plan.notes,
    components: bundle.components
      .filter((component) => component.fee_plan_id === plan.id)
      .map((component) => ({
        component_type: component.component_type,
        label: component.label,
        amount: component.amount,
        pricing_model: component.pricing_model,
        quantity_mode: component.quantity_mode,
        quantity_value: component.quantity_value,
        addon_key: component.addon_key,
        session_price_source: component.session_price_source,
        applies_to_option_types: component.applies_to_option_types,
        sort_order: component.sort_order,
        is_active: component.is_active,
      })),
  }))
}

export function buildDiscountRuleInputs(
  bundle: Awaited<ReturnType<typeof getFeePlanBundleForOffering>>,
  sourcePlanIdToName: Map<string, string>,
  newPlanNameToId: Map<string, string>
): DiscountRuleInput[] {
  return bundle.discountRules.map((rule) => {
    const sourcePlanName = rule.fee_plan_id
      ? sourcePlanIdToName.get(rule.fee_plan_id)
      : null
    const mappedPlanId = sourcePlanName
      ? newPlanNameToId.get(sourcePlanName) ?? null
      : null

    return {
      rule_type: rule.rule_type,
      label: rule.label,
      discount_type: rule.discount_type,
      amount: rule.amount,
      fee_plan_id: mappedPlanId,
      is_active: rule.is_active,
      priority_rank: rule.priority_rank,
      exclude_component_types:
        (rule.conditions as { exclude_component_types?: string[] } | null)
          ?.exclude_component_types ?? ["registration_fee"],
    }
  })
}

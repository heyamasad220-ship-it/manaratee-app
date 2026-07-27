import type { FeePlanEditorState } from "@/components/programs/program-fee-plan-editor"
import type {
  DiscountRuleInput,
  FeePlanComponentInput,
  FeePlanInput,
} from "@/lib/programs/program-fee-plan-actions"
import type {
  ChargeType,
  FeeBillingScope,
  FeeRecurrence,
  OfferingFee,
  PaymentStructure,
  SimpleOfferingPricing,
  SimplePricingDiscountLine,
  SimplePricingDiscounts,
} from "@/lib/programs/offering-pricing-simple-types"
import { defaultFeeName } from "@/lib/programs/offering-pricing-simple-types"
import type {
  FeeComponentType,
  FeePlanType,
  ProgramOfferingDiscountRule,
  ProgramOfferingFeePlan,
  ProgramOfferingFeePlanComponent,
} from "@/lib/programs/program-fee-plan-types"

const OPTIONAL_CHARGE_PREFIX = "opt-charge:"
const SIMPLE_DISCOUNT_KINDS = new Set([
  "sibling",
  "early_bird",
  "full_payment",
  "member_tag",
  "staff_tag",
])

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

function newClientId() {
  return `draft-${Math.random().toString(36).slice(2, 10)}`
}

function feeTypeToComponentType(feeType: ChargeType): FeeComponentType {
  switch (feeType) {
    case "tuition":
      return "tuition"
    case "registration_fee":
      return "registration_fee"
    case "materials":
      return "materials"
    case "lunch":
      return "lunch"
    case "before_care":
    case "after_care":
      return "extended_care"
    default:
      return "custom"
  }
}

function inferFeeType(component: ProgramOfferingFeePlanComponent): ChargeType {
  if (component.component_type === "tuition") return "tuition"
  if (component.component_type === "registration_fee") return "registration_fee"
  if (component.component_type === "materials") return "materials"
  if (component.component_type === "lunch") return "lunch"
  if (component.component_type === "extended_care") {
    const label = component.label.toLowerCase()
    if (label.includes("after")) return "after_care"
    return "before_care"
  }

  const label = component.label.toLowerCase()
  if (label.includes("book")) return "book_fee"
  if (label.includes("before")) return "before_care"
  if (label.includes("after")) return "after_care"
  if (label.includes("lunch")) return "lunch"
  if (label.includes("material")) return "materials"
  if (label.includes("registration")) return "registration_fee"
  if (label.includes("tuition")) return "tuition"

  return "custom"
}

function inferRecurrence(
  component: ProgramOfferingFeePlanComponent,
  planType: FeePlanType
): FeeRecurrence {
  if (
    component.pricing_model === "per_month" ||
    component.quantity_mode === "month_count"
  ) {
    return "monthly"
  }
  if (component.component_type === "tuition" && planType === "monthly") {
    return "monthly"
  }
  return "one_time"
}

function inferBillingScope(
  component: ProgramOfferingFeePlanComponent
): FeeBillingScope {
  const scope = (component as { billing_scope?: string }).billing_scope
  return scope === "family" ? "family" : "individual"
}

function isOptionalFeeComponent(component: ProgramOfferingFeePlanComponent) {
  return (
    component.quantity_mode === "addon_selected" ||
    component.addon_key?.startsWith(OPTIONAL_CHARGE_PREFIX) === true
  )
}

function getDefaultPlan(
  plans: ProgramOfferingFeePlan[],
  components: ProgramOfferingFeePlanComponent[]
) {
  const defaultPlan =
    plans.find((plan) => plan.is_default) ??
    plans.find((plan) => plan.is_active) ??
    plans[0]

  if (!defaultPlan) {
    return null
  }

  return {
    plan: defaultPlan,
    components: components.filter(
      (component) => component.fee_plan_id === defaultPlan.id
    ),
  }
}

function emptyDiscountLine(
  overrides?: Partial<SimplePricingDiscountLine>
): SimplePricingDiscountLine {
  return {
    enabled: false,
    percent: 0,
    endsBefore: "",
    discountTagId: null,
    ...overrides,
  }
}

export function createEmptyDiscounts(): SimplePricingDiscounts {
  return {
    earlyBird: emptyDiscountLine({ percent: 10 }),
    fullPayment: emptyDiscountLine({ percent: 5 }),
    sibling: emptyDiscountLine({ percent: 10 }),
    member: emptyDiscountLine({ percent: 10 }),
    staff: emptyDiscountLine({ percent: 50 }),
  }
}

export function createEmptySimplePricing(): SimpleOfferingPricing {
  return {
    fees: [],
    paymentDueDay: null,
    discounts: createEmptyDiscounts(),
    paymentStructure: "one_time",
    installmentCount: null,
  }
}

function parseDiscountsFromRules(
  rules: ProgramOfferingDiscountRule[]
): SimplePricingDiscounts {
  const discounts = createEmptyDiscounts()

  for (const rule of rules) {
    if (!rule.is_active && rule.amount <= 0) {
      // still load inactive so UI can re-enable
    }

    const conditions = (rule.conditions || {}) as Record<string, unknown>
    const kind =
      typeof conditions.kind === "string" ? conditions.kind : rule.rule_type
    const percent =
      rule.discount_type === "percent" ? Number(rule.amount || 0) : 0

    if (rule.rule_type === "early_bird" || kind === "early_bird") {
      discounts.earlyBird = {
        ruleId: rule.id,
        enabled: rule.is_active,
        percent: percent || discounts.earlyBird.percent,
        endsBefore:
          typeof conditions.ends_before === "string"
            ? conditions.ends_before
            : typeof conditions.endsBefore === "string"
              ? conditions.endsBefore
              : "",
      }
      continue
    }

    if (rule.rule_type === "full_payment" || kind === "full_payment") {
      discounts.fullPayment = {
        ruleId: rule.id,
        enabled: rule.is_active,
        percent: percent || discounts.fullPayment.percent,
      }
      continue
    }

    if (rule.rule_type === "sibling") {
      discounts.sibling = {
        ruleId: rule.id,
        enabled: rule.is_active,
        percent: percent || discounts.sibling.percent,
      }
      continue
    }

    if (kind === "member_tag" || kind === "member") {
      discounts.member = {
        ruleId: rule.id,
        enabled: rule.is_active,
        percent: percent || discounts.member.percent,
        discountTagId:
          typeof conditions.discount_tag_id === "string"
            ? conditions.discount_tag_id
            : null,
      }
      continue
    }

    if (kind === "staff_tag" || kind === "staff") {
      discounts.staff = {
        ruleId: rule.id,
        enabled: rule.is_active,
        percent: percent || discounts.staff.percent,
        discountTagId:
          typeof conditions.discount_tag_id === "string"
            ? conditions.discount_tag_id
            : null,
      }
    }
  }

  return discounts
}

export function parseSimplePricingFromWorkspace(
  feePlans: ProgramOfferingFeePlan[],
  components: ProgramOfferingFeePlanComponent[],
  discountRules: ProgramOfferingDiscountRule[] = []
): SimpleOfferingPricing {
  const bundle = getDefaultPlan(feePlans, components)

  if (!bundle) {
    return {
      ...createEmptySimplePricing(),
      discounts: parseDiscountsFromRules(discountRules),
    }
  }

  const fees: OfferingFee[] = []

  for (const component of bundle.components) {
    if (!component.is_active) continue

    const feeType = inferFeeType(component)
    const name = component.label || defaultFeeName(feeType)

    fees.push({
      clientId: component.id,
      componentId: component.id,
      name,
      amount: Number(component.amount || 0),
      required: !isOptionalFeeComponent(component),
      feeType,
      recurrence: inferRecurrence(component, bundle.plan.plan_type),
      billingScope: inferBillingScope(component),
    })
  }

  const hasMonthly = fees.some((fee) => fee.recurrence === "monthly")
  const paymentStructure: PaymentStructure =
    bundle.plan.plan_type === "installments"
      ? "installments"
      : hasMonthly || bundle.plan.plan_type === "monthly"
        ? "monthly"
        : "one_time"

  return {
    fees,
    paymentDueDay: bundle.plan.payment_due_day,
    discounts: parseDiscountsFromRules(discountRules),
    paymentStructure,
    installmentCount: bundle.plan.installment_count,
  }
}

function feeToComponent(fee: OfferingFee, sortOrder: number): FeePlanComponentInput {
  const name =
    fee.feeType === "custom"
      ? fee.name.trim() || "Custom"
      : fee.name.trim() || defaultFeeName(fee.feeType)
  const pricing_model = fee.recurrence === "monthly" ? "per_month" : "flat"

  if (!fee.required) {
    return {
      id: fee.componentId,
      component_type: feeTypeToComponentType(fee.feeType),
      label: name,
      amount: fee.amount,
      pricing_model,
      quantity_mode: "addon_selected",
      quantity_value: 1,
      addon_key: `${OPTIONAL_CHARGE_PREFIX}${slugify(name) || fee.clientId}`,
      sort_order: sortOrder,
      is_active: true,
      billing_scope: fee.billingScope,
    }
  }

  return {
    id: fee.componentId,
    component_type: feeTypeToComponentType(fee.feeType),
    label: name,
    amount: fee.amount,
    pricing_model,
    quantity_mode: fee.recurrence === "monthly" ? "month_count" : "fixed",
    quantity_value: 1,
    addon_key: null,
    sort_order: sortOrder,
    is_active: true,
    billing_scope: fee.billingScope,
  }
}

function buildDefaultPlanInput(
  offeringName: string,
  existingPlan?: FeePlanInput
): FeePlanInput {
  return {
    id: existingPlan?.id,
    name: existingPlan?.name?.trim() || `${offeringName} — Default Fee`,
    plan_type: existingPlan?.plan_type ?? "one_time",
    is_default: true,
    is_active: true,
    deposit_amount: existingPlan?.deposit_amount ?? 0,
    payment_due_day: existingPlan?.payment_due_day ?? null,
    installment_count: existingPlan?.installment_count ?? null,
    notes: existingPlan?.notes,
    components: existingPlan?.components ?? [],
  }
}

function derivePlanType(simple: SimpleOfferingPricing): FeePlanType {
  if (simple.paymentStructure === "installments") {
    return "installments"
  }
  if (
    simple.paymentStructure === "monthly" ||
    simple.fees.some((fee) => fee.recurrence === "monthly")
  ) {
    return "monthly"
  }
  return "one_time"
}

function discountLineToRule(
  line: SimplePricingDiscountLine,
  rule_type: DiscountRuleInput["rule_type"],
  label: string,
  priority_rank: number,
  extraConditions: Record<string, unknown> = {}
): DiscountRuleInput | null {
  if (!line.enabled && !line.ruleId) {
    return null
  }

  return {
    id: line.ruleId,
    rule_type,
    label,
    discount_type: "percent",
    amount: Math.max(0, Number(line.percent || 0)),
    is_active: line.enabled,
    priority_rank,
    exclude_component_types:
      rule_type === "early_bird"
        ? ["registration_fee", "materials", "lunch", "extended_care", "custom"]
        : ["registration_fee"],
    conditions: {
      ...extraConditions,
      ...(rule_type === "early_bird"
        ? {
            ends_before: line.endsBefore || null,
            applies_to_component_types: ["tuition"],
          }
        : {}),
    },
  }
}

export function buildDiscountRulesFromSimplePricing(
  discounts: SimplePricingDiscounts,
  existingRules: DiscountRuleInput[]
): DiscountRuleInput[] {
  const managed: DiscountRuleInput[] = []

  const earlyBird = discountLineToRule(
    discounts.earlyBird,
    "early_bird",
    "Early Bird",
    20,
    { kind: "early_bird" }
  )
  if (earlyBird) managed.push(earlyBird)

  const fullPayment = discountLineToRule(
    discounts.fullPayment,
    "full_payment",
    "Pay in Full",
    30,
    { kind: "full_payment" }
  )
  if (fullPayment) managed.push(fullPayment)

  const sibling = discountLineToRule(
    discounts.sibling,
    "sibling",
    "Sibling Discount",
    10
  )
  if (sibling) managed.push(sibling)

  const member = discountLineToRule(
    discounts.member,
    "custom",
    "Member Discount",
    40,
    {
      kind: "member_tag",
      discount_tag_id: discounts.member.discountTagId || null,
    }
  )
  if (member) managed.push(member)

  const staff = discountLineToRule(
    discounts.staff,
    "custom",
    "Staff Discount",
    50,
    {
      kind: "staff_tag",
      discount_tag_id: discounts.staff.discountTagId || null,
    }
  )
  if (staff) managed.push(staff)

  const preserved = existingRules.filter((rule) => {
    const kind =
      typeof rule.conditions?.kind === "string"
        ? rule.conditions.kind
        : rule.rule_type
    return !SIMPLE_DISCOUNT_KINDS.has(String(kind)) && rule.rule_type !== "sibling"
  })

  return [...managed, ...preserved]
}

export function buildFeePlanStateFromSimplePricing(
  simple: SimpleOfferingPricing,
  offeringName: string,
  existing: FeePlanEditorState
): FeePlanEditorState {
  const existingDefault =
    existing.plans.find((plan) => plan.is_default) ?? existing.plans[0]
  const otherPlans = existing.plans.filter((plan) => plan !== existingDefault)

  const components = simple.fees
    .filter((fee) => fee.feeType !== "custom" || fee.name.trim() || fee.amount > 0)
    .map((fee, index) => feeToComponent(fee, index * 10))

  const planType = derivePlanType(simple)
  const updatedDefault = buildDefaultPlanInput(offeringName, existingDefault)
  updatedDefault.plan_type = planType
  updatedDefault.installment_count =
    planType === "installments"
      ? Math.max(2, simple.installmentCount ?? 2)
      : null
  updatedDefault.payment_due_day =
    planType === "monthly" ? simple.paymentDueDay ?? 1 : null
  updatedDefault.components = components

  return {
    plans: [updatedDefault, ...otherPlans],
    discountRules: buildDiscountRulesFromSimplePricing(
      simple.discounts,
      existing.discountRules
    ),
    optionFeePlanLinks: existing.optionFeePlanLinks,
  }
}

export function createDefaultFee(
  feeType: ChargeType = "tuition"
): OfferingFee {
  return {
    clientId: newClientId(),
    name: defaultFeeName(feeType),
    amount: 0,
    required: feeType === "tuition" || feeType === "registration_fee",
    feeType,
    recurrence: feeType === "tuition" ? "monthly" : "one_time",
    billingScope: "individual",
  }
}

/** @deprecated Use createDefaultFee */
export function createDefaultCharge(chargeType: ChargeType = "tuition") {
  const fee = createDefaultFee(chargeType)
  return {
    clientId: fee.clientId,
    name: fee.name,
    amount: fee.amount,
    required: fee.required,
    chargeType: fee.feeType,
  }
}

/** @deprecated Add-ons merged into fees */
export function createDefaultAddon() {
  return {
    clientId: newClientId(),
    name: "",
    amount: 0,
    billingMethod: "flat" as const,
  }
}

export function formatPricingCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount || 0)
}

export function summarizeRequiredCharges(fees: OfferingFee[]) {
  return fees
    .filter((fee) => fee.required)
    .reduce((sum, fee) => sum + Number(fee.amount || 0), 0)
}

/** Matches SQL count_offering_billing_months for display. */
export function countOfferingBillingMonths(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): number {
  if (!startDate || !endDate || endDate < startDate) {
    return 1
  }

  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 1
  }

  let count = 0
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)

  while (cursor <= endMonth) {
    count += 1
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return Math.max(count, 1)
}

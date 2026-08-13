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
  OfferingDiscount,
  OfferingFee,
  OfferingPaymentOptions,
  PaymentStructure,
  SimpleOfferingPricing,
  SimplePricingDiscountLine,
} from "@/lib/programs/offering-pricing-simple-types"
import {
  DEFAULT_PAYMENT_OPTIONS,
  defaultFeeName,
  hasMonthlyFeeRecurrence,
  OFFERING_DISCOUNT_NAME_LABELS,
} from "@/lib/programs/offering-pricing-simple-types"
import type {
  FeeComponentType,
  FeePlanType,
  ProgramOfferingDiscountRule,
  ProgramOfferingFeePlan,
  ProgramOfferingFeePlanComponent,
} from "@/lib/programs/program-fee-plan-types"

const OPTIONAL_CHARGE_PREFIX = "opt-charge:"
/** Embedded in fee-plan notes so payment-option toggles survive save. */
const PAYMENT_OPTIONS_NOTES_MARKER = "manaratee_payment_options:"
/** Kinds owned by the Fees-style discount rows UI. */
const ROW_DISCOUNT_KINDS = new Set([
  "sibling",
  "early_bird",
  "full_payment",
  "simple_custom",
])
/** Still preserved on save when present on the plan (not edited on offering). */
const TAG_DISCOUNT_KINDS = new Set(["member_tag", "staff_tag", "member", "staff"])

function newDiscountClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `discount-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

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
  if (label.includes("tuition") || label.includes("program fee")) return "tuition"

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
    valueType: "percent",
    amount: 0,
    ...overrides,
  }
}

export function createEmptyDiscounts(): {
  member: SimplePricingDiscountLine
  staff: SimplePricingDiscountLine
} {
  return {
    member: emptyDiscountLine({ percent: 10 }),
    staff: emptyDiscountLine({ percent: 50 }),
  }
}

export function createEmptySimplePricing(): SimpleOfferingPricing {
  return {
    fees: [],
    paymentDueDay: null,
    discounts: [],
    legacyTagDiscounts: createEmptyDiscounts(),
    paymentStructure: "one_time",
    installmentCount: null,
    paymentOptions: { ...DEFAULT_PAYMENT_OPTIONS },
  }
}

function stripPaymentOptionsMarker(notes: string | null | undefined): string {
  if (!notes) return ""
  return notes
    .split("\n")
    .filter((line) => !line.trim().startsWith(PAYMENT_OPTIONS_NOTES_MARKER))
    .join("\n")
    .trim()
}

function parsePaymentOptionsFromNotes(
  notes: string | null | undefined
): OfferingPaymentOptions | null {
  if (!notes) return null
  const line = notes
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(PAYMENT_OPTIONS_NOTES_MARKER))
  if (!line) return null
  try {
    const parsed = JSON.parse(
      line.slice(PAYMENT_OPTIONS_NOTES_MARKER.length)
    ) as Partial<OfferingPaymentOptions>
    return {
      payInFull: parsed.payInFull !== false,
      twoSemesterPayments: parsed.twoSemesterPayments !== false,
    }
  } catch {
    return null
  }
}

export function encodePaymentOptionsInNotes(
  notes: string | null | undefined,
  options: OfferingPaymentOptions
): string {
  const base = stripPaymentOptionsMarker(notes)
  const marker = `${PAYMENT_OPTIONS_NOTES_MARKER}${JSON.stringify({
    payInFull: options.payInFull === true,
    twoSemesterPayments: options.twoSemesterPayments === true,
  })}`
  return base ? `${base}\n${marker}` : marker
}

function resolvePaymentOptionsFromPlan(
  plan: Pick<ProgramOfferingFeePlan, "notes" | "plan_type" | "installment_count">,
  fees: OfferingFee[]
): OfferingPaymentOptions {
  const fromNotes = parsePaymentOptionsFromNotes(plan.notes)
  if (fromNotes) return fromNotes

  if (!hasMonthlyFeeRecurrence(fees)) {
    return { ...DEFAULT_PAYMENT_OPTIONS }
  }

  const twoSemester =
    plan.plan_type === "installments" &&
    (plan.installment_count == null || plan.installment_count === 2)

  return {
    payInFull: true,
    twoSemesterPayments: twoSemester || plan.plan_type === "installments",
  }
}

function parseDiscountValue(
  rule: ProgramOfferingDiscountRule
): { valueType: SimpleDiscountValueType; value: number } {
  if (rule.discount_type === "fixed_amount") {
    return { valueType: "fixed_amount", value: Number(rule.amount || 0) }
  }
  return { valueType: "percent", value: Number(rule.amount || 0) }
}

function parseDiscountsFromRules(rules: ProgramOfferingDiscountRule[]): {
  discounts: OfferingDiscount[]
  legacyTagDiscounts: {
    member: SimplePricingDiscountLine
    staff: SimplePricingDiscountLine
  }
} {
  const discounts: OfferingDiscount[] = []
  const legacyTagDiscounts = createEmptyDiscounts()

  for (const rule of rules) {
    const conditions = (rule.conditions || {}) as Record<string, unknown>
    const kind =
      typeof conditions.kind === "string" ? conditions.kind : rule.rule_type
    const { valueType, value } = parseDiscountValue(rule)
    const status = rule.is_active ? "active" : "closed"

    if (rule.rule_type === "early_bird" || kind === "early_bird") {
      discounts.push({
        clientId: newDiscountClientId(),
        ruleId: rule.id,
        name: "early_bird",
        valueType,
        value: value || 10,
        status,
        endsBefore:
          typeof conditions.ends_before === "string"
            ? conditions.ends_before
            : typeof conditions.endsBefore === "string"
              ? conditions.endsBefore
              : "",
      })
      continue
    }

    if (rule.rule_type === "full_payment" || kind === "full_payment") {
      discounts.push({
        clientId: newDiscountClientId(),
        ruleId: rule.id,
        name: "full_payment",
        valueType,
        value: value || 5,
        status,
      })
      continue
    }

    if (rule.rule_type === "sibling" || kind === "sibling") {
      discounts.push({
        clientId: newDiscountClientId(),
        ruleId: rule.id,
        name: "sibling",
        valueType,
        value: value || 10,
        status,
      })
      continue
    }

    if (kind === "member_tag" || kind === "member") {
      legacyTagDiscounts.member = {
        ruleId: rule.id,
        enabled: rule.is_active,
        percent: valueType === "percent" ? value : 0,
        amount: valueType === "fixed_amount" ? value : 0,
        valueType,
        discountTagId:
          typeof conditions.discount_tag_id === "string"
            ? conditions.discount_tag_id
            : null,
      }
      continue
    }

    if (kind === "staff_tag" || kind === "staff") {
      legacyTagDiscounts.staff = {
        ruleId: rule.id,
        enabled: rule.is_active,
        percent: valueType === "percent" ? value : 0,
        amount: valueType === "fixed_amount" ? value : 0,
        valueType,
        discountTagId:
          typeof conditions.discount_tag_id === "string"
            ? conditions.discount_tag_id
            : null,
      }
      continue
    }

    if (
      rule.rule_type === "custom" ||
      kind === "simple_custom" ||
      kind === "custom"
    ) {
      discounts.push({
        clientId: newDiscountClientId(),
        ruleId: rule.id,
        name: "custom",
        customLabel: rule.label || "Custom",
        valueType,
        value,
        status,
      })
    }
  }

  return { discounts, legacyTagDiscounts }
}

export function parseSimplePricingFromWorkspace(
  feePlans: ProgramOfferingFeePlan[],
  components: ProgramOfferingFeePlanComponent[],
  discountRules: ProgramOfferingDiscountRule[] = []
): SimpleOfferingPricing {
  const bundle = getDefaultPlan(feePlans, components)

  if (!bundle) {
    const parsed = parseDiscountsFromRules(discountRules)
    return {
      ...createEmptySimplePricing(),
      discounts: parsed.discounts,
      legacyTagDiscounts: parsed.legacyTagDiscounts,
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

  const parsedDiscounts = parseDiscountsFromRules(discountRules)

  return {
    fees,
    paymentDueDay: bundle.plan.payment_due_day,
    discounts: parsedDiscounts.discounts,
    legacyTagDiscounts: parsedDiscounts.legacyTagDiscounts,
    paymentStructure,
    installmentCount: bundle.plan.installment_count,
    paymentOptions: resolvePaymentOptionsFromPlan(bundle.plan, fees),
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
  const hasMonthly = hasMonthlyFeeRecurrence(simple.fees)

  if (hasMonthly) {
    const { payInFull, twoSemesterPayments } = simple.paymentOptions
    if (twoSemesterPayments && !payInFull) {
      return "installments"
    }
    if (payInFull && !twoSemesterPayments) {
      return "one_time"
    }
    if (twoSemesterPayments) {
      return "installments"
    }
    return "monthly"
  }

  if (simple.paymentStructure === "installments") {
    return "installments"
  }
  if (simple.paymentStructure === "monthly") {
    return "monthly"
  }
  return "one_time"
}

function discountRowToRule(
  row: OfferingDiscount,
  priority_rank: number
): DiscountRuleInput | null {
  if (row.status === "closed" && !row.ruleId) {
    return null
  }

  const ruleType =
    row.name === "custom"
      ? "custom"
      : (row.name as DiscountRuleInput["rule_type"])
  const label =
    row.name === "custom"
      ? row.customLabel?.trim() || "Custom"
      : OFFERING_DISCOUNT_NAME_LABELS[row.name]

  return {
    id: row.ruleId,
    rule_type: ruleType,
    label,
    discount_type: row.valueType,
    amount: Math.max(0, Number(row.value || 0)),
    is_active: row.status === "active",
    priority_rank,
    exclude_component_types:
      row.name === "early_bird"
        ? ["registration_fee", "materials", "lunch", "extended_care", "custom"]
        : ["registration_fee"],
    conditions: {
      kind: row.name === "custom" ? "simple_custom" : row.name,
      ...(row.name === "early_bird"
        ? {
            ends_before: row.endsBefore || null,
            applies_to_component_types: ["tuition"],
          }
        : {}),
    },
  }
}

function tagLineToRule(
  line: SimplePricingDiscountLine,
  label: string,
  priority_rank: number,
  kind: "member_tag" | "staff_tag"
): DiscountRuleInput | null {
  if (!line.enabled && !line.ruleId) {
    return null
  }

  const valueType = line.valueType ?? "percent"
  const amount =
    valueType === "fixed_amount"
      ? Math.max(0, Number(line.amount || 0))
      : Math.max(0, Number(line.percent || 0))

  return {
    id: line.ruleId,
    rule_type: "custom",
    label,
    discount_type: valueType,
    amount,
    is_active: line.enabled,
    priority_rank,
    exclude_component_types: ["registration_fee"],
    conditions: {
      kind,
      discount_tag_id: line.discountTagId || null,
    },
  }
}

export function buildDiscountRulesFromSimplePricing(
  discounts: OfferingDiscount[],
  existingRules: DiscountRuleInput[],
  legacyTagDiscounts?: {
    member: SimplePricingDiscountLine
    staff: SimplePricingDiscountLine
  }
): DiscountRuleInput[] {
  const managed: DiscountRuleInput[] = []

  discounts.forEach((row, index) => {
    const rule = discountRowToRule(row, 10 + index * 10)
    if (rule) managed.push(rule)
  })

  if (legacyTagDiscounts) {
    const member = tagLineToRule(
      legacyTagDiscounts.member,
      "Member Discount",
      40,
      "member_tag"
    )
    if (member) managed.push(member)

    const staff = tagLineToRule(
      legacyTagDiscounts.staff,
      "Staff Discount",
      50,
      "staff_tag"
    )
    if (staff) managed.push(staff)
  }

  const preserved = existingRules.filter((rule) => {
    const kind =
      typeof rule.conditions?.kind === "string"
        ? rule.conditions.kind
        : rule.rule_type
    if (ROW_DISCOUNT_KINDS.has(String(kind))) return false
    if (kind === "sibling" || rule.rule_type === "sibling") return false
    if (TAG_DISCOUNT_KINDS.has(String(kind))) return false
    return true
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
      ? Math.max(
          2,
          simple.paymentOptions.twoSemesterPayments
            ? 2
            : (simple.installmentCount ?? 2)
        )
      : null
  updatedDefault.payment_due_day =
    planType === "monthly" ? simple.paymentDueDay ?? 1 : null
  updatedDefault.components = components
  updatedDefault.notes = encodePaymentOptionsInNotes(
    existingDefault?.notes,
    hasMonthlyFeeRecurrence(simple.fees)
      ? simple.paymentOptions
      : DEFAULT_PAYMENT_OPTIONS
  )

  return {
    plans: [updatedDefault, ...otherPlans],
    discountRules: buildDiscountRulesFromSimplePricing(
      simple.discounts,
      existing.discountRules,
      simple.legacyTagDiscounts
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

import type { FeePlanEditorState } from "@/components/programs/program-fee-plan-editor"
import type {
  FeePlanComponentInput,
  FeePlanInput,
} from "@/lib/programs/program-fee-plan-actions"
import type {
  AddonBillingMethod,
  ChargeType,
  OfferingAddon,
  OfferingCharge,
  PaymentStructure,
  SimpleOfferingPricing,
} from "@/lib/programs/offering-pricing-simple-types"
import type {
  FeeComponentType,
  FeePlanType,
  ProgramOfferingFeePlan,
  ProgramOfferingFeePlanComponent,
} from "@/lib/programs/program-fee-plan-types"

const OPTIONAL_CHARGE_PREFIX = "opt-charge:"

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

function chargeTypeToComponentType(chargeType: ChargeType): FeeComponentType {
  switch (chargeType) {
    case "tuition":
      return "tuition"
    case "registration_fee":
      return "registration_fee"
    case "materials":
      return "materials"
    default:
      return "custom"
  }
}

function defaultChargeName(chargeType: ChargeType) {
  switch (chargeType) {
    case "tuition":
      return "Tuition"
    case "registration_fee":
      return "Registration Fee"
    case "book_fee":
      return "Book Fee"
    case "materials":
      return "Materials Fee"
    case "technology_fee":
      return "Technology Fee"
    case "supply_fee":
      return "Supply Fee"
    case "uniform_fee":
      return "Uniform Fee"
    default:
      return "Custom Charge"
  }
}

function inferChargeType(component: ProgramOfferingFeePlanComponent): ChargeType {
  if (component.component_type === "tuition") return "tuition"
  if (component.component_type === "registration_fee") return "registration_fee"
  if (component.component_type === "materials") return "materials"

  const label = component.label.toLowerCase()
  if (label.includes("book")) return "book_fee"
  if (label.includes("technology")) return "technology_fee"
  if (label.includes("supply")) return "supply_fee"
  if (label.includes("uniform")) return "uniform_fee"

  return "custom"
}

function inferAddonBillingMethod(
  component: ProgramOfferingFeePlanComponent
): AddonBillingMethod {
  const label = component.label.toLowerCase()

  if (component.pricing_model === "flat") {
    return "flat"
  }

  if (component.pricing_model === "per_month") {
    return label.includes("week") ? "per_week" : "per_week"
  }

  if (label.includes("day")) {
    return "per_day"
  }

  return "per_session"
}

function addonBillingMethodToPricingModel(method: AddonBillingMethod) {
  switch (method) {
    case "flat":
      return "flat" as const
    case "per_day":
    case "per_session":
      return "per_session" as const
    case "per_week":
      return "per_month" as const
  }
}

function planTypeToPaymentStructure(planType: FeePlanType): PaymentStructure {
  switch (planType) {
    case "monthly":
      return "monthly"
    case "installments":
      return "installments"
    default:
      return "one_time"
  }
}

function paymentStructureToPlanType(structure: PaymentStructure): FeePlanType {
  switch (structure) {
    case "monthly":
      return "monthly"
    case "installments":
      return "installments"
    default:
      return "one_time"
  }
}

function isAddonComponent(component: ProgramOfferingFeePlanComponent) {
  if (
    component.component_type === "lunch" ||
    component.component_type === "extended_care"
  ) {
    return true
  }

  return (
    component.quantity_mode === "addon_selected" &&
    !component.addon_key?.startsWith(OPTIONAL_CHARGE_PREFIX)
  )
}

function isOptionalChargeComponent(component: ProgramOfferingFeePlanComponent) {
  return (
    component.quantity_mode === "addon_selected" &&
    component.addon_key?.startsWith(OPTIONAL_CHARGE_PREFIX) === true
  )
}

function getDefaultPlan(
  plans: ProgramOfferingFeePlan[],
  components: ProgramOfferingFeePlanComponent[]
) {
  const defaultPlan =
    plans.find((plan) => plan.is_default) ?? plans.find((plan) => plan.is_active) ?? plans[0]

  if (!defaultPlan) {
    return null
  }

  return {
    plan: defaultPlan,
    components: components.filter((component) => component.fee_plan_id === defaultPlan.id),
  }
}

export function createEmptySimplePricing(): SimpleOfferingPricing {
  return {
    charges: [],
    addons: [],
    paymentStructure: "one_time",
    installmentCount: null,
    paymentDueDay: null,
  }
}

export function parseSimplePricingFromWorkspace(
  feePlans: ProgramOfferingFeePlan[],
  components: ProgramOfferingFeePlanComponent[]
): SimpleOfferingPricing {
  const bundle = getDefaultPlan(feePlans, components)

  if (!bundle) {
    return createEmptySimplePricing()
  }

  const charges: OfferingCharge[] = []
  const addons: OfferingAddon[] = []

  for (const component of bundle.components) {
    if (!component.is_active) {
      continue
    }

    if (isAddonComponent(component)) {
      addons.push({
        clientId: component.id,
        componentId: component.id,
        name: component.label,
        amount: Number(component.amount || 0),
        billingMethod: inferAddonBillingMethod(component),
      })
      continue
    }

    const required = !isOptionalChargeComponent(component)

    charges.push({
      clientId: component.id,
      componentId: component.id,
      name: component.label || defaultChargeName(inferChargeType(component)),
      amount: Number(component.amount || 0),
      required,
      chargeType: inferChargeType(component),
    })
  }

  return {
    charges,
    addons,
    paymentStructure: planTypeToPaymentStructure(bundle.plan.plan_type),
    installmentCount: bundle.plan.installment_count,
    paymentDueDay: bundle.plan.payment_due_day,
  }
}

function chargeToComponent(charge: OfferingCharge, sortOrder: number): FeePlanComponentInput {
  const name = charge.name.trim() || defaultChargeName(charge.chargeType)

  if (!charge.required) {
    return {
      id: charge.componentId,
      component_type: chargeTypeToComponentType(charge.chargeType),
      label: name,
      amount: charge.amount,
      pricing_model: "flat",
      quantity_mode: "addon_selected",
      quantity_value: 1,
      addon_key: `${OPTIONAL_CHARGE_PREFIX}${slugify(name) || charge.clientId}`,
      sort_order: sortOrder,
      is_active: true,
    }
  }

  return {
    id: charge.componentId,
    component_type: chargeTypeToComponentType(charge.chargeType),
    label: name,
    amount: charge.amount,
    pricing_model: "flat",
    quantity_mode: "fixed",
    quantity_value: 1,
    addon_key: null,
    sort_order: sortOrder,
    is_active: true,
  }
}

function addonToComponent(addon: OfferingAddon, sortOrder: number): FeePlanComponentInput {
  const name = addon.name.trim() || "Add-On"

  return {
    id: addon.componentId,
    component_type: "custom",
    label: name,
    amount: addon.amount,
    pricing_model: addonBillingMethodToPricingModel(addon.billingMethod),
    quantity_mode: "addon_selected",
    quantity_value: 1,
    addon_key: slugify(name) || addon.clientId,
    sort_order: sortOrder,
    is_active: true,
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

export function buildFeePlanStateFromSimplePricing(
  simple: SimpleOfferingPricing,
  offeringName: string,
  existing: FeePlanEditorState
): FeePlanEditorState {
  const existingDefault =
    existing.plans.find((plan) => plan.is_default) ?? existing.plans[0]
  const otherPlans = existing.plans.filter((plan) => plan !== existingDefault)

  const components = [
    ...simple.charges.map((charge, index) => chargeToComponent(charge, index * 10)),
    ...simple.addons.map((addon, index) =>
      addonToComponent(addon, simple.charges.length * 10 + index * 10 + 10)
    ),
  ]

  const updatedDefault = buildDefaultPlanInput(offeringName, existingDefault)
  updatedDefault.plan_type = paymentStructureToPlanType(simple.paymentStructure)
  updatedDefault.installment_count =
    simple.paymentStructure === "installments"
      ? Math.max(2, simple.installmentCount ?? 2)
      : null
  updatedDefault.payment_due_day =
    simple.paymentStructure === "monthly" ? simple.paymentDueDay : null
  updatedDefault.components = components

  return {
    plans: [updatedDefault, ...otherPlans],
    discountRules: existing.discountRules,
    optionFeePlanLinks: existing.optionFeePlanLinks,
  }
}

export function createDefaultCharge(chargeType: ChargeType = "tuition"): OfferingCharge {
  return {
    clientId: newClientId(),
    name: defaultChargeName(chargeType),
    amount: 0,
    required: true,
    chargeType,
  }
}

export function createDefaultAddon(): OfferingAddon {
  return {
    clientId: newClientId(),
    name: "",
    amount: 0,
    billingMethod: "flat",
  }
}

export function formatPricingCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount || 0)
}

export function summarizeRequiredCharges(charges: OfferingCharge[]) {
  return charges
    .filter((charge) => charge.required)
    .reduce((sum, charge) => sum + Number(charge.amount || 0), 0)
}

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import type {
  ProgramOfferingDiscountRule,
  ProgramOfferingFeePlan,
  ProgramOfferingFeePlanComponent,
} from "@/lib/programs/program-fee-plan-types"

export async function getFeePlansForOffering(offeringId: string, organizationId?: string) {
  const supabase = await createClient()
  const orgId = organizationId ?? (await getSelectedOrganizationId())

  if (!orgId) return []

  const { data, error } = await supabase
    .from("program_offering_fee_plans")
    .select("*")
    .eq("organization_id", orgId)
    .eq("offering_id", offeringId)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true })

  if (error) throw new Error(error.message)
  return (data || []) as ProgramOfferingFeePlan[]
}

export async function getFeePlanComponentsForPlans(planIds: string[], organizationId: string) {
  if (planIds.length === 0) return []

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("program_offering_fee_plan_components")
    .select("*")
    .eq("organization_id", organizationId)
    .in("fee_plan_id", planIds)
    .order("sort_order", { ascending: true })

  if (error) throw new Error(error.message)
  return (data || []) as ProgramOfferingFeePlanComponent[]
}

export async function getDiscountRulesForOffering(offeringId: string, organizationId?: string) {
  const supabase = await createClient()
  const orgId = organizationId ?? (await getSelectedOrganizationId())

  if (!orgId) return []

  const { data, error } = await supabase
    .from("program_offering_discount_rules")
    .select("*")
    .eq("organization_id", orgId)
    .eq("offering_id", offeringId)
    .order("priority_rank", { ascending: true })

  if (error) throw new Error(error.message)
  return (data || []) as ProgramOfferingDiscountRule[]
}

export type InvalidFeePlanLink = {
  optionId: string
  optionName: string
  optionType: string
  feePlanId: string
}

export async function getInvalidFeePlanLinksForOffering(
  offeringId: string,
  organizationId?: string
) {
  const orgId = organizationId ?? (await getSelectedOrganizationId())
  if (!orgId) return [] as InvalidFeePlanLink[]

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("program_registration_options")
    .select("id, name, option_type, fee_plan_id")
    .eq("organization_id", orgId)
    .eq("offering_id", offeringId)
    .not("fee_plan_id", "is", null)

  if (error) throw new Error(error.message)

  const options = data || []
  if (options.length === 0) return [] as InvalidFeePlanLink[]

  const planIds = [
    ...new Set(options.map((row) => row.fee_plan_id as string).filter(Boolean)),
  ]

  const { data: plans, error: planError } = await supabase
    .from("program_offering_fee_plans")
    .select("id")
    .eq("organization_id", orgId)
    .eq("offering_id", offeringId)
    .eq("is_active", true)
    .in("id", planIds)

  if (planError) throw new Error(planError.message)

  const validPlanIds = new Set((plans || []).map((row) => row.id as string))

  return options
    .filter(
      (row) => row.fee_plan_id && !validPlanIds.has(row.fee_plan_id as string)
    )
    .map((row) => ({
      optionId: row.id as string,
      optionName: (row.name as string) || (row.option_type as string),
      optionType: row.option_type as string,
      feePlanId: row.fee_plan_id as string,
    }))
}

export async function getFeePlanBundleForOffering(offeringId: string, organizationId?: string) {
  const orgId = organizationId ?? (await getSelectedOrganizationId())
  if (!orgId) {
    return { plans: [], components: [], discountRules: [] }
  }

  const plans = await getFeePlansForOffering(offeringId, orgId)
  const planIds = plans.map((plan) => plan.id)
  const [components, discountRules] = await Promise.all([
    getFeePlanComponentsForPlans(planIds, orgId),
    getDiscountRulesForOffering(offeringId, orgId),
  ])

  return { plans, components, discountRules }
}

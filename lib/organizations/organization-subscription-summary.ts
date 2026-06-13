import { getSubscriptionBundle } from "@/lib/modules/module-catalog"
import {
  getOrganizationModuleAccess,
  type OrganizationModuleStatus,
} from "@/lib/modules/organization-module-access"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"

export type OrganizationSubscriptionModule = {
  slug: string
  name: string
  description: string | null
  enabled: boolean
  enabledByPlan: boolean
  manuallyOverridden: boolean
}

export type OrganizationSubscriptionSummary = {
  organizationName: string
  plan: {
    id: string
    name: string
    description: string | null
    monthlyPrice: number
    yearlyPrice: number
    memberLimit: number | null
    eventLimit: number | null
  } | null
  bundleSlug: string | null
  bundleName: string | null
  bundleDescription: string | null
  billingLabel: string
  billingAmount: number
  coreModules: OrganizationSubscriptionModule[]
  productModules: OrganizationSubscriptionModule[]
  capabilityModules: OrganizationSubscriptionModule[]
}

function formatBundlePrice(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatSubscriptionPrice(amount: number) {
  return formatBundlePrice(amount)
}

export async function getOrganizationSubscriptionSummary(
  organizationId: string
): Promise<OrganizationSubscriptionSummary> {
  const admin = getServiceRoleClient()

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select(
      `
      name,
      subscription_bundle_slug,
      plan_id,
      plans (
        id,
        name,
        description,
        monthly_price,
        yearly_price,
        member_limit,
        event_limit
      )
    `
    )
    .eq("id", organizationId)
    .maybeSingle()

  if (orgError) {
    throw new Error(orgError.message)
  }

  if (!org) {
    throw new Error("Organization not found")
  }

  const planRow = Array.isArray(org.plans) ? org.plans[0] : org.plans
  const plan = planRow
    ? {
        id: planRow.id as string,
        name: planRow.name as string,
        description: (planRow.description as string | null) ?? null,
        monthlyPrice: Number(planRow.monthly_price || 0),
        yearlyPrice: Number(planRow.yearly_price || 0),
        memberLimit: (planRow.member_limit as number | null) ?? null,
        eventLimit: (planRow.event_limit as number | null) ?? null,
      }
    : null

  const bundleSlug = (org.subscription_bundle_slug as string | null) ?? null
  const bundle = bundleSlug ? getSubscriptionBundle(bundleSlug) : null

  const access = await getOrganizationModuleAccess(organizationId)

  const mapModule = (item: OrganizationModuleStatus): OrganizationSubscriptionModule => ({
    slug: item.slug,
    name: item.name,
    description: item.description,
    enabled: item.enabled,
    enabledByPlan: item.enabledByPlan,
    manuallyOverridden: Boolean(item.organizationModuleId) && item.enabled && !item.enabledByPlan,
  })

  const monthlyPrice = plan?.monthlyPrice ?? 0

  return {
    organizationName: org.name as string,
    plan,
    bundleSlug,
    bundleName: bundle?.name ?? null,
    bundleDescription: bundle?.description ?? null,
    billingLabel: plan ? `${formatBundlePrice(monthlyPrice)}/month` : "Not assigned",
    billingAmount: monthlyPrice,
    coreModules: access.coreModules.map(mapModule),
    productModules: access.catalogModules
      .filter((item) => item.enabled)
      .map(mapModule),
    capabilityModules: access.capabilityModules
      .filter((item) => item.enabled)
      .map(mapModule),
  }
}

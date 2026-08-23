import { loadOrganizationSubscription } from "@/lib/billing/organization-subscription-service"
import { formatCentsAsUsd } from "@/lib/billing/money"
import {
  getSubscriptionBundle,
  isHiddenSubscriptionCapabilitySlug,
} from "@/lib/modules/module-catalog"
import {
  getOrganizationModuleAccess,
  type OrganizationModuleStatus,
} from "@/lib/modules/organization-module-access"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { computeOrganizationSubscriptionTerms } from "@/lib/organizations/organization-subscription-terms"
import {
  type OrganizationSubscriptionModule,
  type OrganizationSubscriptionSummary,
} from "@/lib/organizations/organization-subscription-types"

export type { OrganizationSubscriptionModule, OrganizationSubscriptionSummary } from "@/lib/organizations/organization-subscription-types"
export { formatSubscriptionPrice } from "@/lib/organizations/organization-subscription-types"

export async function getOrganizationSubscriptionSummary(
  organizationId: string
): Promise<OrganizationSubscriptionSummary> {
  const admin = getServiceRoleClient()

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select(
      `
      name,
      subscription_start_date,
      complimentary_months,
      first_year_special_monthly_rate,
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

  const snapshot = await loadOrganizationSubscription(organizationId)
  const billedMonthlyCents = snapshot?.billedMonthlyCents ?? 0
  const billedMonthlyDollars = billedMonthlyCents / 100
  const subscriptionTerms = computeOrganizationSubscriptionTerms(
    {
      subscriptionStartDate: (org.subscription_start_date as string | null) ?? null,
      complimentaryMonths: Number(org.complimentary_months || 0),
      firstYearSpecialMonthlyRate:
        org.first_year_special_monthly_rate == null
          ? null
          : Number(org.first_year_special_monthly_rate),
    },
    billedMonthlyDollars
  )

  const billingAmount = snapshot
    ? subscriptionTerms.currentEffectiveMonthlyRate
    : 0
  const billingLabel = snapshot
    ? subscriptionTerms.billingPhaseLabel
    : "Not assigned"

  return {
    organizationName: org.name as string,
    subscriptionTerms,
    plan,
    bundleSlug,
    bundleName: bundle?.name ?? null,
    bundleDescription: bundle?.description ?? null,
    billingLabel,
    billingAmount,
    billedMonthlyCents,
    calculatedMonthlyCents: snapshot?.calculatedMonthlyCents ?? 0,
    customMonthlyCents: snapshot?.customMonthlyCents ?? null,
    isPriceLocked: Boolean(snapshot?.isPriceLocked),
    billedMonthlyDisplay: formatCentsAsUsd(billedMonthlyCents),
    coreModules: access.coreModules.map(mapModule),
    productModules: access.catalogModules
      .filter((item) => item.enabled)
      .map(mapModule),
    capabilityModules: access.capabilityModules
      .filter(
        (item) => item.enabled && !isHiddenSubscriptionCapabilitySlug(item.slug)
      )
      .map(mapModule),
  }
}

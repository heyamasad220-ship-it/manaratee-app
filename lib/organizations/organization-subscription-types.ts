export type OrganizationSubscriptionModule = {
  slug: string
  name: string
  description: string | null
  enabled: boolean
  enabledByPlan: boolean
  manuallyOverridden: boolean
}

import type { OrganizationSubscriptionTerms } from "@/lib/organizations/organization-subscription-terms"

export type { OrganizationSubscriptionTerms } from "@/lib/organizations/organization-subscription-terms"

export type OrganizationSubscriptionSummary = {
  organizationName: string
  subscriptionTerms: OrganizationSubscriptionTerms
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

export function formatSubscriptionPrice(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

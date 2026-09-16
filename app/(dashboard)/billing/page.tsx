import { OrganizationBillingClient } from "@/components/organizations/organization-billing-client"
import { getOrganizationBillingProfileAction } from "@/lib/organizations/organization-billing-actions"
import { requireOrganizationSuperAdmin } from "@/lib/organizations/organization-billing-access"
import { getOrganizationSubscriptionSummary } from "@/lib/organizations/organization-subscription-summary"
import { computeOrganizationSubscriptionTerms } from "@/lib/organizations/organization-subscription-terms"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

const emptySummary = {
  organizationName: "your organization",
  subscriptionTerms: computeOrganizationSubscriptionTerms(
    {
      subscriptionStartDate: null,
      complimentaryMonths: 0,
      firstYearSpecialMonthlyRate: null,
    },
    0
  ),
  plan: null,
  bundleSlug: null,
  bundleName: null,
  bundleDescription: null,
  billingLabel: "Not assigned",
  billingAmount: 0,
  coreModules: [],
  productModules: [],
  capabilityModules: [],
}

export default async function OrganizationBillingPage() {
  await requireOrganizationSuperAdmin()

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return (
      <OrganizationBillingClient
        summary={emptySummary}
        billingEmail={null}
        paymentMethods={[]}
        invoices={[]}
      />
    )
  }

  const profile = await getOrganizationBillingProfileAction()
  if (!profile.success) {
    const summary = await getOrganizationSubscriptionSummary(organizationId)
    return (
      <OrganizationBillingClient
        summary={summary}
        billingEmail={null}
        paymentMethods={[]}
        invoices={[]}
      />
    )
  }

  return (
    <OrganizationBillingClient
      summary={profile.summary}
      billingEmail={profile.billingEmail}
      paymentMethods={profile.paymentMethods}
      invoices={profile.invoices}
    />
  )
}

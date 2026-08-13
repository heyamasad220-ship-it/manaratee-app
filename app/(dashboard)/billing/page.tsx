import { OrganizationBillingClient } from "@/components/organizations/organization-billing-client"
import { getOrganizationBillingProfileAction } from "@/lib/organizations/organization-billing-actions"
import { requireOrganizationSuperAdmin } from "@/lib/organizations/organization-billing-access"
import { getOrganizationSubscriptionSummary } from "@/lib/organizations/organization-subscription-summary"
import { computeOrganizationSubscriptionTerms } from "@/lib/organizations/organization-subscription-terms"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getOrganizationProgramKindsEntitlement } from "@/lib/programs/organization-program-kinds"

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
        programKinds="both"
        billingEmail={null}
        paymentMethods={[]}
        invoices={[]}
      />
    )
  }

  const [profile, programKinds] = await Promise.all([
    getOrganizationBillingProfileAction(),
    getOrganizationProgramKindsEntitlement(),
  ])
  if (!profile.success) {
    const summary = await getOrganizationSubscriptionSummary(organizationId)
    return (
      <OrganizationBillingClient
        summary={summary}
        programKinds={programKinds}
        billingEmail={null}
        paymentMethods={[]}
        invoices={[]}
      />
    )
  }

  return (
    <OrganizationBillingClient
      summary={profile.summary}
      programKinds={programKinds}
      billingEmail={profile.billingEmail}
      paymentMethods={profile.paymentMethods}
      invoices={profile.invoices}
    />
  )
}

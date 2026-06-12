import { OpportunitiesClient } from "@/components/customer/opportunities-client"
import { getServiceOpportunitiesForCurrentUser } from "@/lib/service-participations/service-participation-queries"
import { requireCustomerPortalPageContext } from "@/lib/auth/require-customer-portal-page"

export default async function CustomerOpportunitiesPage() {
  await requireCustomerPortalPageContext()

  const { opportunities, eligibility } = await getServiceOpportunitiesForCurrentUser()

  return (
    <OpportunitiesClient opportunities={opportunities} eligibility={eligibility} />
  )
}

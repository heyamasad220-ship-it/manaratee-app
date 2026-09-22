import { redirect } from "next/navigation"

import { CustomerDashboardView } from "@/components/customer/customer-dashboard-view"
import { loadCustomerDashboardPageData } from "@/lib/customer/customer-dashboard-data"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"

export default async function CustomerDashboardPage() {
  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization) {
    redirect("/login")
  }

  const data = await loadCustomerDashboardPageData()

  return <CustomerDashboardView data={data} />
}

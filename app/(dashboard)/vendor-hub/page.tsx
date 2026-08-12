import { VendorHubDashboardClient } from "@/components/vendor-hub/vendor-hub-dashboard-client"
import { getVendorHubOrgDashboard } from "@/lib/vendor-hub/vendor-hub-event-queries"

export default async function VendorHubDashboardPage() {
  const { metrics, upcomingEvents } = await getVendorHubOrgDashboard()

  return <VendorHubDashboardClient metrics={metrics} upcomingEvents={upcomingEvents} />
}

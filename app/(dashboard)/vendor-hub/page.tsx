import { VendorHubDashboardClient } from "@/components/vendor-hub/vendor-hub-dashboard-client"
import { getVendorHubDashboardMetrics } from "@/lib/vendor-hub/vendor-hub-event-queries"

export default async function VendorHubDashboardPage() {
  const events = await getVendorHubDashboardMetrics(null)
  const initialMetrics = events

  return <VendorHubDashboardClient initialMetrics={initialMetrics} />
}

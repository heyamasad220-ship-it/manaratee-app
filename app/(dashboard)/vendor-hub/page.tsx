import { VendorHubDashboardClient } from "@/components/vendor-hub/vendor-hub-dashboard-client"
import { getVendorHubOrgDashboard } from "@/lib/vendor-hub/vendor-hub-event-queries"
import { getVendorHubReportsData } from "@/lib/vendor-hub/vendor-hub-reports-queries"

export default async function VendorHubOverviewPage() {
  const [{ metrics, upcomingEvents }, reports] = await Promise.all([
    getVendorHubOrgDashboard(),
    getVendorHubReportsData(null),
  ])

  return (
    <VendorHubDashboardClient
      metrics={metrics}
      upcomingEvents={upcomingEvents}
      reportsOverview={reports.overview}
    />
  )
}

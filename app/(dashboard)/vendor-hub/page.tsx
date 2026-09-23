import { VendorHubDashboardClient } from "@/components/vendor-hub/vendor-hub-dashboard-client"
import { getVendorHubOrgDashboard } from "@/lib/vendor-hub/vendor-hub-event-queries"
import {
  countUnpaidBooths,
  sumBoothsOpen,
  sumBoothsTotal,
} from "@/lib/vendor-hub/vendor-hub-overview"
import { getVendorHubReportsData } from "@/lib/vendor-hub/vendor-hub-reports-queries"

export default async function VendorHubOverviewPage() {
  const { metrics, upcomingEvents } = await getVendorHubOrgDashboard()
  const currentEventId = metrics.currentEventId

  const reports = currentEventId ? await getVendorHubReportsData(currentEventId) : null
  const boothPerformance = reports?.boothPerformance ?? []
  const vendorSales = reports?.vendorSales ?? []

  return (
    <VendorHubDashboardClient
      metrics={metrics}
      upcomingEvents={upcomingEvents}
      currentEventName={metrics.currentEventName}
      boothsOpen={sumBoothsOpen(boothPerformance)}
      boothsTotal={sumBoothsTotal(boothPerformance)}
      unpaidBooths={countUnpaidBooths(vendorSales)}
    />
  )
}

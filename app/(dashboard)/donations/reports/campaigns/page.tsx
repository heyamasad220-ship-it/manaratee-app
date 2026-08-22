import { Suspense } from "react"

import { CampaignPerformanceReportPanel } from "@/components/donations/campaign-performance-report-panel"

export default function DonationCampaignPerformancePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading report...</div>}>
      <CampaignPerformanceReportPanel />
    </Suspense>
  )
}

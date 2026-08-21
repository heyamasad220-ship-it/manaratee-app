import { Suspense } from "react"

import { CampaignGroupsReportPanel } from "@/components/donations/campaign-groups-report-panel"

export default function DonationsCampaignGroupsReportPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading report...</div>}>
      <CampaignGroupsReportPanel />
    </Suspense>
  )
}

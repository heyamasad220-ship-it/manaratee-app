import { Suspense } from "react"

import { GivingSummaryReportPanel } from "@/components/donations/giving-summary-report-panel"

export default function DonationGivingSummaryPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading report...</div>}>
      <GivingSummaryReportPanel />
    </Suspense>
  )
}

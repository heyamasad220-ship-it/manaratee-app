import { Suspense } from "react"

import { DonorsReportPanel } from "@/components/donations/donors-report-panel"

export default function DonationsDonorsReportPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading report...</div>}>
      <DonorsReportPanel />
    </Suspense>
  )
}

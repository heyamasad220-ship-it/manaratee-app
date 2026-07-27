import { Suspense } from "react"

import { DonationReportsTabs } from "@/components/donations/donation-reports-chrome"
import { PaymentImportMatchWorkspace } from "@/components/donations/payment-import-match-workspace"

export default function DonationReportsImportPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <DonationReportsTabs />
      <Suspense
        fallback={<div className="text-sm text-muted-foreground">Loading import workspace...</div>}
      >
        <PaymentImportMatchWorkspace mode="import" />
      </Suspense>
    </div>
  )
}

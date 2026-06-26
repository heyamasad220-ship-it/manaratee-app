import { Suspense } from "react"

import { DonationOpsPanel } from "@/components/donations/donation-ops-panel"
import { PaymentImportMatchWorkspace } from "@/components/donations/payment-import-match-workspace"

export default function DonationPaymentsMatchPage() {
  return (
    <div className="flex flex-col gap-6">
      <DonationOpsPanel />
      <Suspense
        fallback={<div className="text-sm text-muted-foreground">Loading match workspace...</div>}
      >
        <PaymentImportMatchWorkspace mode="match" />
      </Suspense>
    </div>
  )
}

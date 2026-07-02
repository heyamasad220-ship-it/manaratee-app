import { Suspense } from "react"

import { PaymentImportMatchWorkspace } from "@/components/donations/payment-import-match-workspace"

export default function DonationReportsImportPage() {
  return (
    <div className="p-6">
      <Suspense
        fallback={<div className="text-sm text-muted-foreground">Loading import workspace...</div>}
      >
        <PaymentImportMatchWorkspace mode="import" />
      </Suspense>
    </div>
  )
}

import { Suspense } from "react"

import { PaymentImportMatchWorkspace } from "@/components/donations/payment-import-match-workspace"

export default function DonationsImportPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-sm text-muted-foreground">Loading import workspace...</div>}
    >
      <PaymentImportMatchWorkspace />
    </Suspense>
  )
}

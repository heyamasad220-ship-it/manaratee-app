import { Suspense } from "react"

import { DonationPaymentsPanel } from "@/components/donations/donation-payments-panel"

export default function DonationTransactionsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading transactions...</p>}>
        <DonationPaymentsPanel embedded defaultRange="all" />
      </Suspense>
    </div>
  )
}

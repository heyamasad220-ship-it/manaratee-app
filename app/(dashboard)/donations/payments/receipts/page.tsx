import { Suspense } from "react"

import { DonationReceiptsWorkspace } from "@/components/donations/donation-receipts-workspace"

export default function DonationReceiptsOpsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading receipts...</div>}>
      <DonationReceiptsWorkspace />
    </Suspense>
  )
}

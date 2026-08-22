import { Suspense } from "react"

import { DonationImportMatchPage } from "@/components/donations/donation-import-match-page"

export default function DonationImportMatchRoutePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading import workspace...</div>}>
      <DonationImportMatchPage />
    </Suspense>
  )
}

import { Suspense } from "react"

import { DonationReportsLanding } from "@/components/donations/donation-reports-landing"

export default function DonationsReportsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading reports...</div>}>
      <DonationReportsLanding />
    </Suspense>
  )
}

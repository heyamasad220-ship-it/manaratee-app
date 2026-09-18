"use client"

import { DonationPaymentsPanel } from "@/components/donations/donation-payments-panel"

export function GivingSummaryReportPanel() {
  return (
    <div className="p-6">
      <DonationPaymentsPanel
        embedded
        readOnly
        showCharts
        defaultRange="30d"
        defaultStatusDisplay="Succeeded"
      />
    </div>
  )
}

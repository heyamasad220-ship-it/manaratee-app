"use client"

import { DonationPaymentsPanel } from "@/components/donations/donation-payments-panel"

export function GivingSummaryReportPanel() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Giving Summary</h2>
        <p className="text-sm text-muted-foreground">
          Successful received payments for this organization. Open a row to view the transaction;
          receive, import, and receipt actions live under Donations.
        </p>
      </div>
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

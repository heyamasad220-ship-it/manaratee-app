"use client"

import { DonationRecurringPanel } from "@/components/donations/donation-recurring-panel"

export function RecurringGivingReportPanel() {
  return (
    <div className="p-6">
      <DonationRecurringPanel embedded readOnly />
    </div>
  )
}

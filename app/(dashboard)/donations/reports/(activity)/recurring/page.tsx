import { DonationRecurringPanel } from "@/components/donations/donation-recurring-panel"
import { DonationReportsTabs } from "@/components/donations/donation-reports-chrome"

export default function DonationReportsRecurringPage() {
  return (
    <div className="p-6">
      <DonationRecurringPanel embedded showReportsTabs />
    </div>
  )
}

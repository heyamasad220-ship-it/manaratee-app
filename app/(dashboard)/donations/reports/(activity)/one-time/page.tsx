import { DonationOneTimeOverviewCards } from "@/components/donations/donation-one-time-overview-cards"
import { DonationPaymentsPanel } from "@/components/donations/donation-payments-panel"
import { DonationReportsTabs } from "@/components/donations/donation-reports-chrome"

export default function DonationReportsOneTimePage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <DonationOneTimeOverviewCards />
      <DonationReportsTabs />
      <DonationPaymentsPanel embedded />
    </div>
  )
}

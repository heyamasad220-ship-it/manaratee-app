import { DonationOneTimeOverviewCards } from "@/components/donations/donation-one-time-overview-cards"
import { DonationPaymentsPanel } from "@/components/donations/donation-payments-panel"

export default function DonationPaymentsOneTimePage() {
  return (
    <div className="flex flex-col gap-6">
      <DonationOneTimeOverviewCards />
      <DonationPaymentsPanel embedded />
    </div>
  )
}

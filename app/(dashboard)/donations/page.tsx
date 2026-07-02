import { Header } from "@/components/layout/header"
import { DonationsOverviewDashboard } from "@/components/donations/donations-overview-dashboard"

export default function DonationsPage() {
  return (
    <>
      <Header title="Donations" />
      <div className="p-6">
        <DonationsOverviewDashboard />
      </div>
    </>
  )
}

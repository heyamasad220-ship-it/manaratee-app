import { Header } from "@/components/layout/header"
import { DonationsOverviewDashboard } from "@/components/donations/donations-overview-dashboard"
import { FUND_DEVELOPMENT_MODULE_LABEL } from "@/lib/donations/fund-development-module-label"

export default function DonationsPage() {
  return (
    <>
      <Header title={FUND_DEVELOPMENT_MODULE_LABEL} />
      <div className="p-6">
        <DonationsOverviewDashboard />
      </div>
    </>
  )
}

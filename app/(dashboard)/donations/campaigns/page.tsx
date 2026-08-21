import { redirect } from "next/navigation"

import { DonationCampaignsOverviewTable } from "@/components/donations/donation-campaigns-overview-table"
import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"

export default async function DonationsCampaignsOverviewPage() {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) {
    redirect("/dashboard")
  }

  return (
    <div className="p-6">
      <DonationCampaignsOverviewTable canManage={access.canManageCampaigns} />
    </div>
  )
}

import { Suspense } from "react"
import { redirect } from "next/navigation"

import { DonationCampaignsHome } from "@/components/donations/donation-campaigns-home"
import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"

export default async function DonationsCampaignsOverviewPage() {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) {
    redirect("/dashboard")
  }

  return (
    <div className="p-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading campaigns...</p>}>
        <DonationCampaignsHome canManage={access.canManageCampaigns} />
      </Suspense>
    </div>
  )
}

import { redirect } from "next/navigation"

import { DonationCampaignsShell } from "@/components/donations/donation-campaigns-shell"
import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"

export default async function DonationsCampaignsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) {
    redirect("/dashboard")
  }

  return (
    <DonationCampaignsShell canManage={access.canManage}>{children}</DonationCampaignsShell>
  )
}

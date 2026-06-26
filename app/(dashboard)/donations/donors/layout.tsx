import { redirect } from "next/navigation"

import { DonationReportsChrome } from "@/components/donations/donation-reports-chrome"
import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"

export default async function DonationsDonorsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) {
    redirect("/dashboard")
  }

  return <DonationReportsChrome>{children}</DonationReportsChrome>
}

import { redirect } from "next/navigation"

import { DonationManagerNav } from "@/components/donations/donation-manager-nav"
import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"

export default async function DonationsManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) {
    redirect("/dashboard")
  }

  return (
    <>
      <DonationManagerNav canManage={access.canManage} />
      {children}
    </>
  )
}

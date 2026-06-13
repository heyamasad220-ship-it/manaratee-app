import { redirect } from "next/navigation"

import { DonationPaymentsNav } from "@/components/donations/donation-payments-nav"
import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"

export default async function DonationsOperationsLayout({
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
      <DonationPaymentsNav canManage={access.canManage} />
      {children}
    </>
  )
}

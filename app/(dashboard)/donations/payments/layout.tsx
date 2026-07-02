import { redirect } from "next/navigation"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"

export default async function DonationsPaymentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) {
    redirect("/dashboard")
  }

  return <>{children}</>
}

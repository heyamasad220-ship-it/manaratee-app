import { guardCustomerPortalPath } from "@/lib/customer/customer-portal-modules-server"

export default async function CustomerDonationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await guardCustomerPortalPath("/customer/donation")
  return children
}

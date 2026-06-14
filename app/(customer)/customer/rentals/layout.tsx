import { guardCustomerPortalPath } from "@/lib/customer/customer-portal-modules-server"

export default async function CustomerRentalsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await guardCustomerPortalPath("/customer/rentals")
  return children
}

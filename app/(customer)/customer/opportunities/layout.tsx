import { guardCustomerPortalPath } from "@/lib/customer/customer-portal-modules-server"

export default async function CustomerOpportunitiesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await guardCustomerPortalPath("/customer/opportunities")
  return children
}

import { guardCustomerPortalPath } from "@/lib/customer/customer-portal-modules-server"

export default async function CustomerProgramsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await guardCustomerPortalPath("/customer/programs")
  return children
}

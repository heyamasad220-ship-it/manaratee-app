import { guardCustomerPortalPath } from "@/lib/customer/customer-portal-modules-server"

export default async function CustomerBazaarsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await guardCustomerPortalPath("/customer/bazaars")
  return children
}

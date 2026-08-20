import { requireCustomerPortalAnyModule } from "@/lib/customer/customer-portal-modules-server"

export default async function CustomerTicketsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireCustomerPortalAnyModule(["event-management", "ticketing"])
  return children
}

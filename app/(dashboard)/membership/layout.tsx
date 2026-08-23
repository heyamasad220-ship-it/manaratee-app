import { requireOrganizationModule } from "@/lib/modules/dashboard-module-access-server"

export default async function MembershipLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireOrganizationModule("membership")
  return children
}

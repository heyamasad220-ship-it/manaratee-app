import { requireOrganizationModule } from "@/lib/modules/dashboard-module-access-server"

export default async function WorkforceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireOrganizationModule("workforce")
  return children
}

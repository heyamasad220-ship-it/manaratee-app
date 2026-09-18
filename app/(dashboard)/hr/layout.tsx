import { requireOrganizationModule } from "@/lib/modules/dashboard-module-access-server"

export default async function HrLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireOrganizationModule("workforce")
  return children
}

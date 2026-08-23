import { requireOrganizationModule } from "@/lib/modules/dashboard-module-access-server"
import { PERMISSIONS, requireAnyPermission } from "@/lib/permissions/permissions"

export default async function DonationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireOrganizationModule("donations")
  await requireAnyPermission(
    PERMISSIONS.DONATIONS_VIEW,
    PERMISSIONS.DONATIONS_MANAGE
  )

  return <>{children}</>
}

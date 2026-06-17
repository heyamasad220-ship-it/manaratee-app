import { requireOrganizationModule } from "@/lib/modules/dashboard-module-access-server"
import { PERMISSIONS, requireAnyPermission } from "@/lib/permissions/permissions"

export default async function ProgramsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireOrganizationModule("programs")
  await requireAnyPermission(
    PERMISSIONS.PROGRAMS_VIEW,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  return children
}

import { redirect } from "next/navigation"

import { getDepartmentHeadshipForCurrentUser } from "@/lib/departments/department-access"
import { requireOrganizationModule } from "@/lib/modules/dashboard-module-access-server"
import {
  hasAnyPermission,
  PERMISSIONS,
} from "@/lib/permissions/permissions"

export default async function ProgramsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireOrganizationModule("programs")

  const canViewPrograms = await hasAnyPermission(
    PERMISSIONS.PROGRAMS_VIEW,
    PERMISSIONS.PROGRAMS_MANAGE
  )
  if (!canViewPrograms) {
    const headship = await getDepartmentHeadshipForCurrentUser()
    if (!headship) {
      redirect("/unauthorized")
    }
  }

  return children
}

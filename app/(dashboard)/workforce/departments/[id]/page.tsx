import { DepartmentGroupWorkspaceClient } from "@/components/departments/department-group-workspace-client"
import { requireDepartmentView } from "@/lib/departments/department-access"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"

export default async function WorkforceDepartmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  await requireDepartmentView(id)
  const { from } = await searchParams
  const entryPoint = from === "donations" ? "donations" : "hr"

  const [canManageEvents, canRequestEvents] = await Promise.all([
    hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
    hasAnyPermission(
      PERMISSIONS.EVENTS_VIEW,
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_VIEW,
      PERMISSIONS.PROGRAMS_MANAGE
    ),
  ])

  return (
    <DepartmentGroupWorkspaceClient
      departmentId={id}
      entryPoint={entryPoint}
      canManageEvents={canManageEvents}
      canRequestEvents={canRequestEvents}
    />
  )
}

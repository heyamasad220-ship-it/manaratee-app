import { DepartmentGroupWorkspaceClient } from "@/components/departments/department-group-workspace-client"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function WorkforceDepartmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  await requirePermission(PERMISSIONS.STAFF_VIEW)
  const { id } = await params
  const { from } = await searchParams
  const entryPoint = from === "donations" ? "donations" : "hr"

  return (
    <DepartmentGroupWorkspaceClient departmentId={id} entryPoint={entryPoint} />
  )
}

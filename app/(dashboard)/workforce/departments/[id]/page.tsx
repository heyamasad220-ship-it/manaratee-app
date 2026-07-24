import { DepartmentGroupWorkspaceClient } from "@/components/departments/department-group-workspace-client"
import { requireDepartmentView } from "@/lib/departments/department-access"

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

  return (
    <DepartmentGroupWorkspaceClient departmentId={id} entryPoint={entryPoint} />
  )
}

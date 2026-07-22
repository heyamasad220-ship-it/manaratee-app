import { Header } from "@/components/layout/header"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getDepartments } from "@/lib/departments/department-queries"
import { ProgramForm } from "@/components/programs/program-form"

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function CreateProgramPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolved = await searchParams
  const defaultDepartmentId = getValue(resolved?.department) || null

  const [departments, organizationId] = await Promise.all([
    getDepartments(),
    getSelectedOrganizationId(),
  ])

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const departmentExists =
    defaultDepartmentId &&
    departments.some((department) => department.id === defaultDepartmentId)

  return (
    <>
      <Header title="Programs" />
      <ProgramForm
        mode="create"
        departments={departments}
        organizationId={organizationId}
        defaultDepartmentId={departmentExists ? defaultDepartmentId : null}
      />
    </>
  )
}

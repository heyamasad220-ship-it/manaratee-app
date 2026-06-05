import { Header } from "@/components/layout/header"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getDepartments } from "@/lib/departments/department-queries"
import { ProgramForm } from "@/components/programs/program-form"

export default async function CreateProgramPage() {
  const [departments, organizationId] = await Promise.all([
    getDepartments(),
    getSelectedOrganizationId(),
  ])

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  return (
    <>
      <Header title="Programs" />
      <ProgramForm
        mode="create"
        departments={departments}
        organizationId={organizationId}
      />
    </>
  )
}

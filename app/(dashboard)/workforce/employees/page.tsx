import { Header } from "@/components/layout/header"
import { HrEmployeesPageClient } from "@/components/hr/hr-employees-page-client"
import { ModuleApplicationsLink } from "@/components/applications/module-applications-link"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

export default async function HrEmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; staffTab?: string }>
}) {
  const { tab, staffTab } = await searchParams
  const organizationId = await getSelectedOrganizationId()

  return (
    <>
      <Header
        title="Employees"
        actions={
          <ModuleApplicationsLink applicationType="employment" label="Employment Applications" />
        }
      />
      <HrEmployeesPageClient
        organizationId={organizationId}
        initialTab={tab}
        initialStaffTab={staffTab}
      />
    </>
  )
}

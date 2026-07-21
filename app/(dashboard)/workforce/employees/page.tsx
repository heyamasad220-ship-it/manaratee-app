import { Header } from "@/components/layout/header"
import { HrEmployeesPageClient } from "@/components/hr/hr-employees-page-client"
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
      <Header title="Employees" />
      <HrEmployeesPageClient
        organizationId={organizationId}
        initialTab={tab}
        initialStaffTab={staffTab}
      />
    </>
  )
}

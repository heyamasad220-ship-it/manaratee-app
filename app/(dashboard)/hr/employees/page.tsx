import { Header } from "@/components/layout/header"
import { HrEmployeesPageClient } from "@/components/hr/hr-employees-page-client"
import { ModuleApplicationsLink } from "@/components/applications/module-applications-link"

export default async function HrEmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams

  return (
    <>
      <Header
        title="Employees"
        actions={
          <ModuleApplicationsLink applicationType="employment" label="Employment Applications" />
        }
      />
      <HrEmployeesPageClient initialTab={tab} />
    </>
  )
}

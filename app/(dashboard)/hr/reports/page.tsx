import { Header } from "@/components/layout/header"
import { HRReportsClient } from "@/components/hr/hr-reports-client"
import { PEOPLE_MANAGEMENT_MODULE_LABEL } from "@/lib/hr/hr-module-label"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

export default async function HRReportsPage() {
  const organizationId = await getSelectedOrganizationId()

  return (
    <>
      <Header title={`${PEOPLE_MANAGEMENT_MODULE_LABEL} Reports`} />
      <HRReportsClient organizationId={organizationId} />
    </>
  )
}

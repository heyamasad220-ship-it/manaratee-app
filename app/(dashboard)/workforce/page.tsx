import { Suspense } from "react"
import { Header } from "@/components/layout/header"
import { HrOverviewClient } from "@/components/hr/hr-overview-client"
import { fetchChildcareProvidersData } from "@/lib/hr/childcare-provider-actions"
import { fetchPeopleManagementOverview } from "@/lib/hr/hr-overview-actions"
import { WORKFORCE_MODULE_LABEL } from "@/lib/hr/hr-module-label"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function WorkforceOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requirePermission(PERMISSIONS.STAFF_VIEW)

  const { tab } = await searchParams
  const [overview, organizationId, childcare] = await Promise.all([
    fetchPeopleManagementOverview(),
    getSelectedOrganizationId(),
    fetchChildcareProvidersData(),
  ])

  return (
    <>
      <Header title={WORKFORCE_MODULE_LABEL} />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted m-6" />}>
        <HrOverviewClient
          organizationId={organizationId}
          overviewStats={{
            employees: overview.employees.totalEmployees,
            volunteers: overview.volunteerContacts,
            childcareProviders: overview.childcareProviders,
          }}
          childcareProviders={childcare.providers}
          childcareStats={childcare.stats}
          initialTab={tab}
        />
      </Suspense>
    </>
  )
}

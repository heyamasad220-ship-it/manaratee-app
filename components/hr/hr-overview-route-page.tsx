import { Suspense } from "react"

import { Header } from "@/components/layout/header"
import { HrOverviewClient } from "@/components/hr/hr-overview-client"
import { fetchChildcareProvidersData } from "@/lib/hr/childcare-provider-actions"
import { fetchPeopleManagementOverview } from "@/lib/hr/hr-overview-actions"
import { WORKFORCE_MODULE_LABEL } from "@/lib/hr/hr-module-label"
import type { HrOverviewTab } from "@/lib/hr/hr-overview-path"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

/** Shared HR overview shell for path-based section routes. */
export async function HrOverviewRoutePage({
  initialTab,
}: {
  initialTab: HrOverviewTab
}) {
  await requirePermission(PERMISSIONS.STAFF_VIEW)

  const [overview, organizationId, childcare] = await Promise.all([
    fetchPeopleManagementOverview(),
    getSelectedOrganizationId(),
    fetchChildcareProvidersData(),
  ])

  return (
    <>
      <Header title={WORKFORCE_MODULE_LABEL} />
      <Suspense
        fallback={
          <div className="m-6 h-64 animate-pulse rounded-lg bg-muted" />
        }
      >
        <HrOverviewClient
          organizationId={organizationId}
          overviewStats={{
            employees: overview.employees.totalEmployees,
            volunteers: overview.volunteerContacts,
            childcareProviders: overview.childcareProviders,
          }}
          childcareProviders={childcare.providers}
          childcareStats={childcare.stats}
          initialTab={initialTab}
        />
      </Suspense>
    </>
  )
}

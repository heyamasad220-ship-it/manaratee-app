import { Suspense } from "react"
import { Header } from "@/components/layout/header"
import { PeopleManagementApplicationsClient } from "@/components/applications/people-management-applications-client"
import { PEOPLE_MANAGEMENT_APPLICATIONS_HUB_TYPES } from "@/lib/applications/application-types"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function SettingsApplicationsPage() {
  await requirePermission(PERMISSIONS.APPLICATIONS_VIEW)

  return (
    <>
      <Header title="Applications" />
      <Suspense>
        <PeopleManagementApplicationsClient
          hubApplicationTypes={PEOPLE_MANAGEMENT_APPLICATIONS_HUB_TYPES}
          basePath="/settings/applications"
        />
      </Suspense>
    </>
  )
}

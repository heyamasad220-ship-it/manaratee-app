"use client"

import { ModuleApplicationsClient } from "@/components/applications/module-applications-client"
import { PEOPLE_MANAGEMENT_APPLICATIONS_PATH } from "@/lib/applications/application-routes"

export function PeopleManagementApplicationsClient({
  hubApplicationTypes,
}: {
  hubApplicationTypes: readonly string[]
}) {
  return (
    <ModuleApplicationsClient
      moduleOwner="hr"
      basePath={PEOPLE_MANAGEMENT_APPLICATIONS_PATH}
      title="Applications"
      hubApplicationTypes={hubApplicationTypes}
    />
  )
}

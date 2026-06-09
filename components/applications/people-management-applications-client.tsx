"use client"

import { ModuleApplicationsClient } from "@/components/applications/module-applications-client"
import { PEOPLE_MANAGEMENT_APPLICATIONS_PATH } from "@/lib/applications/application-routes"

export function PeopleManagementApplicationsClient({
  hubApplicationTypes,
  basePath = PEOPLE_MANAGEMENT_APPLICATIONS_PATH,
}: {
  hubApplicationTypes: readonly string[]
  basePath?: string
}) {
  return (
    <ModuleApplicationsClient
      moduleOwner="workforce"
      basePath={basePath}
      title="Applications"
      hubApplicationTypes={hubApplicationTypes}
    />
  )
}

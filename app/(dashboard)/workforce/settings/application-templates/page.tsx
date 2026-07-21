import { Header } from "@/components/layout/header"
import { PeopleManagementSettingsShell } from "@/components/hr/people-management-settings-shell"
import { ApplicationTemplatesPanel } from "@/components/applications/application-templates-panel"
import { PEOPLE_MANAGEMENT_APPLICATIONS_HUB_TYPES } from "@/lib/applications/application-types"
import { PEOPLE_MANAGEMENT_APPLICATIONS_PATH } from "@/lib/applications/application-routes"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function WorkforceSettingsApplicationTemplatesPage() {
  await requirePermission(PERMISSIONS.APPLICATIONS_VIEW)

  return (
    <>
      <Header title="Settings" />
      <div className="p-6">
        <PeopleManagementSettingsShell>
          <ApplicationTemplatesPanel
            moduleOwner="workforce"
            basePath={PEOPLE_MANAGEMENT_APPLICATIONS_PATH}
            hubApplicationTypes={PEOPLE_MANAGEMENT_APPLICATIONS_HUB_TYPES}
          />
        </PeopleManagementSettingsShell>
      </div>
    </>
  )
}

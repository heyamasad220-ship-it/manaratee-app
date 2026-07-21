import { Header } from "@/components/layout/header"
import { PeopleManagementSettingsShell } from "@/components/hr/people-management-settings-shell"
import { HrPositionsManager } from "@/components/hr/hr-positions-manager"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function WorkforceSettingsPositionsPage() {
  await requirePermission(PERMISSIONS.STAFF_VIEW)

  return (
    <>
      <Header title="Settings" />
      <div className="p-6">
        <PeopleManagementSettingsShell>
          <HrPositionsManager />
        </PeopleManagementSettingsShell>
      </div>
    </>
  )
}

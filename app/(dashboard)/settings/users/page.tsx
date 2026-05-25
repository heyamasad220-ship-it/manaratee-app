import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"
import { UsersSettingsClient } from "./users-settings-client"

export default async function UsersSettingsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_USERS_VIEW)

  const organizationId = await getSelectedOrganizationId()

  return <UsersSettingsClient organizationId={organizationId} />
}

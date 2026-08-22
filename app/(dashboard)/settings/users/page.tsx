import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  fetchOrganizationUsersForSettings,
  type OrganizationSettingsRole,
  type OrganizationSettingsUser,
} from "@/lib/organizations/organization-users-actions"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"
import { UsersSettingsClient } from "./users-settings-client"

export default async function UsersSettingsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_USERS_VIEW)

  const organizationId = await getSelectedOrganizationId()
  let organizationName = "your organization"
  let initialUsers: OrganizationSettingsUser[] = []
  let initialRoles: OrganizationSettingsRole[] = []
  let initialError: string | null = organizationId
    ? null
    : "No organization selected."

  if (organizationId) {
    const admin = getServiceRoleClient()
    const { data } = await admin
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .maybeSingle()

    if (data?.name) organizationName = data.name as string

    try {
      const payload = await fetchOrganizationUsersForSettings()
      initialUsers = payload.users
      initialRoles = payload.roles
    } catch (loadError) {
      initialError =
        loadError instanceof Error
          ? loadError.message
          : "Could not load organization users."
    }
  }

  return (
    <UsersSettingsClient
      organizationId={organizationId}
      organizationName={organizationName}
      initialUsers={initialUsers}
      initialRoles={initialRoles}
      initialError={initialError}
    />
  )
}

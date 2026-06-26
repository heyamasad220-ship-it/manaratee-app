import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { loadOrganizationEnabledModuleSlugs } from "@/lib/modules/dashboard-module-access-server"
import { filterPermissionDefinitionsForOrganization } from "@/lib/permissions/permission-definitions"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"
import { RolesPermissionsClient } from "./roles-permissions-client"

export default async function RolesPermissionsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_ROLES_VIEW)

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return <RolesPermissionsClient organizationId="" enabledModuleSlugs={[]} permissionDefinitions={[]} />
  }

  const enabledModuleSlugs = await loadOrganizationEnabledModuleSlugs(organizationId)
  const permissionDefinitions = filterPermissionDefinitionsForOrganization(enabledModuleSlugs)

  return (
    <RolesPermissionsClient
      organizationId={organizationId}
      enabledModuleSlugs={enabledModuleSlugs}
      permissionDefinitions={permissionDefinitions}
    />
  )
}

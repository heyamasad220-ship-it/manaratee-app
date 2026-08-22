import { loadOrganizationEnabledModuleSlugs } from "@/lib/modules/dashboard-module-access-server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { loadOrganizationRolesWorkspaceAction } from "@/lib/organizations/organization-role-actions"
import { filterPermissionDefinitionsForOrganization } from "@/lib/permissions/permission-definitions"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"
import { RolesPermissionsClient } from "./roles-permissions-client"

export default async function RolesPermissionsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_ROLES_VIEW)

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return (
      <RolesPermissionsClient
        organizationId=""
        enabledModuleSlugs={[]}
        permissionDefinitions={[]}
        initialRoles={[]}
        initialMembers={[]}
        initialPermissions={[]}
        initialError="No organization selected."
      />
    )
  }

  const enabledModuleSlugs = await loadOrganizationEnabledModuleSlugs(organizationId)
  const permissionDefinitions = filterPermissionDefinitionsForOrganization(enabledModuleSlugs)
  const workspace = await loadOrganizationRolesWorkspaceAction()

  return (
    <RolesPermissionsClient
      organizationId={organizationId}
      enabledModuleSlugs={enabledModuleSlugs}
      permissionDefinitions={permissionDefinitions}
      initialRoles={workspace.success ? workspace.roles : []}
      initialMembers={workspace.success ? workspace.members : []}
      initialPermissions={workspace.success ? workspace.permissions : []}
      initialError={workspace.success ? null : workspace.error}
    />
  )
}

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"
import { RolesPermissionsClient } from "./roles-permissions-client"

export default async function RolesPermissionsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_ROLES_VIEW)

  const organizationId = await getSelectedOrganizationId()

  return <RolesPermissionsClient organizationId={organizationId} />
}

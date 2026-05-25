import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"
import { ApplicationsClient } from "./applications-client"

export default async function SettingsApplicationsPage() {
  await requirePermission(PERMISSIONS.APPLICATIONS_VIEW)

  const organizationId = await getSelectedOrganizationId()

  return <ApplicationsClient organizationId={organizationId} />
}

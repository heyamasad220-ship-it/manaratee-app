import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"
import { UsersSettingsClient } from "./users-settings-client"

export default async function UsersSettingsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_USERS_VIEW)

  const organizationId = await getSelectedOrganizationId()
  let organizationName = "your organization"
  let organizationSlug: string | null = null

  if (organizationId) {
    const admin = getServiceRoleClient()
    const { data } = await admin
      .from("organizations")
      .select("name, slug")
      .eq("id", organizationId)
      .maybeSingle()

    if (data?.name) organizationName = data.name as string
    if (data?.slug) organizationSlug = data.slug as string
  }

  return (
    <UsersSettingsClient
      organizationId={organizationId}
      organizationName={organizationName}
      organizationSlug={organizationSlug}
    />
  )
}

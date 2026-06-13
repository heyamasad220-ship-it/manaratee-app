import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getOrganizationSubscriptionSummary } from "@/lib/organizations/organization-subscription-summary"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"
import { SubscriptionSettingsClient } from "./subscription-settings-client"

export default async function SubscriptionSettingsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_USERS_VIEW)

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return (
      <SubscriptionSettingsClient
        summary={{
          organizationName: "your organization",
          plan: null,
          bundleSlug: null,
          bundleName: null,
          bundleDescription: null,
          billingLabel: "Not assigned",
          billingAmount: 0,
          coreModules: [],
          productModules: [],
          capabilityModules: [],
        }}
      />
    )
  }

  const summary = await getOrganizationSubscriptionSummary(organizationId)

  return <SubscriptionSettingsClient summary={summary} />
}

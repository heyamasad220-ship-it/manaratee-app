import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

/** Staff dashboard cookie first, then customer portal active organization. */
export async function resolveOrganizationId(): Promise<string | null> {
  const selectedOrganizationId = await getSelectedOrganizationId()

  if (selectedOrganizationId) {
    return selectedOrganizationId
  }

  const { activeOrganization } = await getActiveOrganization()
  return activeOrganization?.organization_id ?? null
}

import { getCurrentOrganizationId } from "@/lib/current-organization"

export async function getSelectedOrganizationIdClient() {
  return getCurrentOrganizationId()
}

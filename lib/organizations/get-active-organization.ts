import { cookies } from "next/headers"
import type { CustomerOrganization } from "@/lib/customer/customer-organization-types"
import { getMyOrganizations } from "@/lib/organizations/get-my-organizations"

export async function getActiveOrganization(): Promise<{
  activeOrganization: CustomerOrganization | null
  organizations: CustomerOrganization[]
}> {
  const organizations = await getMyOrganizations()

  if (!organizations || organizations.length === 0) {
    return {
      activeOrganization: null,
      organizations: [],
    }
  }

  const cookieStore = await cookies()

  const cookieOrganizationId = cookieStore.get(
    "active_organization_id"
  )?.value

  const activeOrganization =
    organizations.find(
      (org) => org.organization_id === cookieOrganizationId
    ) || organizations[0]

  return {
    activeOrganization,
    organizations,
  }
}
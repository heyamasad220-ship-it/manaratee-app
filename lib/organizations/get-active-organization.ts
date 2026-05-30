import { cookies } from "next/headers"
import { getMyOrganizations } from "@/lib/organizations/get-my-organizations"

export async function getActiveOrganization() {
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
      (org: any) => org.organization_id === cookieOrganizationId
    ) || organizations[0]

  return {
    activeOrganization,
    organizations,
  }
}
import { cookies } from "next/headers"
import type { CustomerOrganization } from "@/lib/customer/customer-organization-types"
import { getMyOrganizations } from "@/lib/organizations/get-my-organizations"
import { getOrgUserSupportOrganizationId } from "@/lib/organizations/org-user-access"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"

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

  const supportOrgId = await getOrgUserSupportOrganizationId()
  const cookieOrganizationId =
    supportOrgId ||
    cookieStore.get("active_organization_id")?.value

  const activeOrganization =
    organizations.find(
      (org) => org.organization_id === cookieOrganizationId
    ) || organizations[0]

  if (supportOrgId && !organizations.some((org) => org.organization_id === supportOrgId)) {
    const admin = getServiceRoleClient()
    const { data: org } = await admin
      .from("organizations")
      .select("id, name, logo_url")
      .eq("id", supportOrgId)
      .maybeSingle()

    if (org?.name) {
      const supportOrganization = {
        organization_id: supportOrgId,
        organization_name: org.name as string,
        role_name: "Customer",
        logo_url: (org.logo_url as string | null) ?? null,
      }

      return {
        activeOrganization: supportOrganization,
        organizations: [supportOrganization, ...organizations],
      }
    }
  }

  return {
    activeOrganization,
    organizations,
  }
}
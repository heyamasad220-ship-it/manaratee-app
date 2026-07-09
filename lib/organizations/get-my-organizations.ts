import { createClient } from "@/lib/supabase/server"
import type { CustomerOrganization } from "@/lib/customer/customer-organization-types"
import { normalizeCustomerOrganizations } from "@/lib/customer/customer-portal-role-label"
import { getOrgUserSupportSession } from "@/lib/organizations/org-user-access"
import { getOrganizationsForUserId } from "@/lib/organizations/get-organizations-for-user"

async function enrichOrganizationsWithLogos(
  organizations: CustomerOrganization[]
): Promise<CustomerOrganization[]> {
  if (organizations.length === 0) {
    return []
  }

  const supabase = await createClient()
  const orgIds = organizations.map((organization) => organization.organization_id)

  const { data, error } = await supabase
    .from("organizations")
    .select("id, logo_url")
    .in("id", orgIds)

  if (error) {
    console.error("enrichOrganizationsWithLogos:", error)
    return organizations
  }

  const logoByOrgId = new Map(
    (data || []).map((row) => [row.id as string, (row.logo_url as string | null) ?? null])
  )

  return organizations.map((organization) => ({
    ...organization,
    logo_url: logoByOrgId.get(organization.organization_id) ?? null,
  }))
}

export async function getMyOrganizations(): Promise<CustomerOrganization[]> {
  const supportSession = await getOrgUserSupportSession()

  if (supportSession) {
    return getOrganizationsForUserId(supportSession.actingUserId)
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc("get_my_organizations")

  if (error) {
    console.error("Get my organizations error:", error)
    return []
  }

  const organizations = normalizeCustomerOrganizations((data || []) as CustomerOrganization[])
  return enrichOrganizationsWithLogos(organizations)
}
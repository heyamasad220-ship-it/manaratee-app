import type { SupabaseClient } from "@supabase/supabase-js"

import type { CustomerOrganization } from "@/lib/customer/customer-organization-types"
import {
  formatCustomerPortalRoleLabel,
  normalizeCustomerOrganizations,
} from "@/lib/customer/customer-portal-role-label"
import { isOrganizationSystemAdmin } from "@/lib/organizations/organization-system-admin"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"

export async function getOrganizationsForUserId(
  userId: string,
  adminClient?: SupabaseClient
): Promise<CustomerOrganization[]> {
  const admin = adminClient ?? getServiceRoleClient()
  const byOrgId = new Map<string, CustomerOrganization>()

  const { data: contacts, error: contactsError } = await admin
    .from("contacts")
    .select("organization_id, organizations:organization_id(id, name, logo_url)")
    .eq("auth_user_id", userId)

  if (contactsError) {
    console.error("getOrganizationsForUserId contacts:", contactsError)
  }

  for (const row of contacts || []) {
    const orgId = row.organization_id as string | undefined
    const org = row.organizations as { id?: string; name?: string; logo_url?: string | null } | null
    if (!orgId || !org?.name) continue

    byOrgId.set(orgId, {
      organization_id: orgId,
      organization_name: org.name,
      role_name: "Customer",
      logo_url: org.logo_url ?? null,
    })
  }

  const { data: memberships, error: membershipsError } = await admin
    .from("organization_members")
    .select("organization_id, role, organizations:organization_id(id, name, logo_url)")
    .eq("user_id", userId)
    .eq("status", "active")

  if (membershipsError) {
    console.error("getOrganizationsForUserId memberships:", membershipsError)
  }

  for (const row of memberships || []) {
    const orgId = row.organization_id as string | undefined
    const org = row.organizations as { id?: string; name?: string; logo_url?: string | null } | null
    const role = row.role as string | undefined

    if (!orgId || !org?.name || !role) continue
    if (isOrganizationSystemAdmin(role)) continue

    if (!byOrgId.has(orgId)) {
      byOrgId.set(orgId, {
        organization_id: orgId,
        organization_name: org.name,
        role_name: formatCustomerPortalRoleLabel(role),
        logo_url: org.logo_url ?? null,
      })
    }
  }

  return normalizeCustomerOrganizations([...byOrgId.values()])
}

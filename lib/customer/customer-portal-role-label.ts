import type { CustomerOrganization } from "@/lib/customer/customer-organization-types"

/** Customer portal display label for organization access (not staff system roles). */
export function formatCustomerPortalRoleLabel(
  roleName: string | null | undefined
): string {
  const normalized = (roleName ?? "").trim().toLowerCase()

  if (!normalized) return "Customer"

  // Legacy portal users were migrated from role = customer → viewer (migration 014).
  if (normalized === "viewer" || normalized === "customer") {
    return "Customer"
  }

  if (normalized === "member") {
    return "Member"
  }

  return roleName.trim()
}

export function normalizeCustomerOrganizations(
  organizations: CustomerOrganization[]
): CustomerOrganization[] {
  return organizations.map((organization) => ({
    ...organization,
    role_name: formatCustomerPortalRoleLabel(organization.role_name),
  }))
}

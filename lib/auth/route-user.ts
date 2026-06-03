import { createClient } from "@/lib/supabase/client"
import {
  ORG_ADMIN_DASHBOARD_ROLES,
} from "@/lib/organizations/organization-member-constants"
import {
  selectOrganization,
  setActiveOrganization,
} from "@/lib/organizations/organization-actions"

function isOrgAdminDashboardRole(role: string | null | undefined) {
  return ORG_ADMIN_DASHBOARD_ROLES.includes(
    role as (typeof ORG_ADMIN_DASHBOARD_ROLES)[number]
  )
}

export async function routeUserByRole(
  userId: string,
  router: { push: (path: string) => void; refresh?: () => void }
) {
  const supabase = createClient()

  /**
   * 1. Platform admin
   */
  const { data: platformAdmin, error: platformError } = await supabase
    .from("platform_admins")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle()

  if (platformError) throw platformError

  if (platformAdmin) {
    router.push("/admin")
    return
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", userId)
    .maybeSingle()

  if (profileError) throw profileError

  if (profile?.is_platform_admin === true) {
    router.push("/admin/dashboard")
    return
  }

  /**
   * 2. Organization memberships + contact links
   */
  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, role, status")
    .eq("user_id", userId)
    .eq("status", "active")

  if (membershipError) throw membershipError

  const { data: contactRows, error: contactError } = await supabase
    .from("contacts")
    .select("organization_id")
    .eq("auth_user_id", userId)

  if (contactError) throw contactError

  const contactOrgIds = (contactRows || [])
    .map((row) => row.organization_id as string)
    .filter(Boolean)

  const adminMembership = memberships?.find((membership) =>
    isOrgAdminDashboardRole(membership.role)
  )

  if (adminMembership) {
    await selectOrganization(adminMembership.organization_id)
    router.refresh?.()
    router.push("/dashboard")
    return
  }

  /**
   * Customer portal: linked contact record without elevated staff role.
   * Legacy customer memberships were migrated to role = viewer (migration 014).
   */
  const hasContactLink = contactOrgIds.length > 0
  const hasOnlyViewerMembership =
    (memberships?.length ?? 0) === 0 ||
    memberships?.every((membership) => membership.role === "viewer")

  if (hasContactLink && hasOnlyViewerMembership) {
    const customerOrgId =
      memberships?.find((membership) =>
        contactOrgIds.includes(membership.organization_id)
      )?.organization_id ?? contactOrgIds[0]

    await setActiveOrganization(customerOrgId)
    router.refresh?.()
    router.push("/customer/dashboard")
    return
  }

  const viewerMembership = memberships?.find(
    (membership) => membership.role === "viewer"
  )

  if (viewerMembership) {
    await selectOrganization(viewerMembership.organization_id)
    router.refresh?.()
    router.push("/dashboard")
    return
  }

  if (memberships && memberships.length > 0) {
    await selectOrganization(memberships[0].organization_id)
    router.refresh?.()
    router.push("/dashboard")
    return
  }

  /**
   * 3. Customer profile fallback
   */
  const { data: customerProfile, error: customerError } = await supabase
    .from("customer_profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle()

  if (customerError) throw customerError

  if (customerProfile?.organization_id) {
    await setActiveOrganization(customerProfile.organization_id)
    router.refresh?.()
    router.push("/customer/dashboard")
    return
  }

  /**
   * 4. Fallback
   */
  router.push("/customer/dashboard")
}

/** Paths that should not bypass role-based routing after OAuth / magic links. */
export function shouldRouteByRoleAfterAuth(nextPath: string | null | undefined) {
  return nextPath === "/dashboard"
}

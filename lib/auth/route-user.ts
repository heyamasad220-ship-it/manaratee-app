import { createClient } from "@/lib/supabase/client"
import { selectOrganization } from "@/lib/organizations/organization-actions"

export async function routeUserByRole(
  userId: string,
  router: { push: (path: string) => void; refresh?: () => void }
) {
  const supabase = createClient()

  /**
   * 1. Platform admin
   */
  const { data: platformAdmin, error: platformError } =
    await supabase
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
   * 2. Organization member/admin
   */
  const { data: memberships, error: membershipError } =
    await supabase
      .from("organization_members")
      .select("organization_id, role, status")
      .eq("user_id", userId)
      .eq("status", "active")

  if (membershipError) throw membershipError

  const orgAdminMembership = memberships?.find((membership) =>
    ["super_admin", "admin", "coordinator", "viewer"].includes(membership.role)
  )

  if (orgAdminMembership) {
    await selectOrganization(orgAdminMembership.organization_id)
    router.refresh?.()
    router.push("/dashboard")
    return
  }

  const customerMembership = memberships?.find(
    (membership) => membership.role === "customer"
  )

  if (customerMembership) {
    router.push("/customer/dashboard")
    return
  }

  if (memberships && memberships.length > 0) {
    await selectOrganization(memberships[0].organization_id)
    router.refresh?.()
    router.push("/dashboard")
    return
  }

  /**
   * 3. Customer profile
   */
  const { data: customerProfile, error: customerError } =
    await supabase
      .from("customer_profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle()

  if (customerError) throw customerError

  if (customerProfile?.organization_id) {
    router.push("/customer/dashboard")
    return
  }

  /**
   * 4. Fallback
   */
  router.push("/customer/dashboard")
}

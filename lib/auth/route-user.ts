import { createClient } from "@/lib/supabase/client"

export async function routeUserByRole(
  userId: string,
  router: any
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

  /**
   * 2. Organization member/admin
   */
  const { data: memberships, error: membershipError } =
    await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId)

  if (membershipError) throw membershipError

  if (memberships && memberships.length > 0) {
    const firstOrgId = memberships[0].organization_id

    const selectResponse = await fetch(
      "/api/organizations/select",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId: firstOrgId,
        }),
      }
    )

    if (!selectResponse.ok) {
      throw new Error(
        "Failed to set selected organization"
      )
    }

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
    router.push(
      `/organizations/${customerProfile.organization_id}`
    )
    return
  }

  /**
   * 4. Fallback
   */
  router.push("/customer/dashboard")
}
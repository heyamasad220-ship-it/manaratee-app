import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions/permission-keys"

export { PERMISSIONS, type PermissionKey }

export async function getCurrentUserPermissionContext() {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("id, user_id, organization_id, role, role_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (membershipError || !membership) {
    redirect("/unauthorized")
  }

  return {
    supabase,
    user,
    organizationId,
    membership,
  }
}

export async function hasPermission(permissionKey: PermissionKey) {
  const { supabase, membership, organizationId } =
    await getCurrentUserPermissionContext()

  // Platform/system owner always has access.
  if (membership.role === "owner") {
    return true
  }

  if (!membership.role_id) {
    return false
  }

  const { data, error } = await supabase
    .from("role_permissions")
    .select("enabled")
    .eq("organization_id", organizationId)
    .eq("role_id", membership.role_id)
    .eq("permission_key", permissionKey)
    .maybeSingle()

  if (error) {
    console.error("Permission check error:", error)
    return false
  }

  return data?.enabled === true
}

export async function requirePermission(permissionKey: PermissionKey) {
  const allowed = await hasPermission(permissionKey)

  if (!allowed) {
    redirect("/unauthorized")
  }
}

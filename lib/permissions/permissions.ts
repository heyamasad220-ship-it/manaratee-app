import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

export const PERMISSIONS = {
  SETTINGS_USERS_VIEW: "settings.users.view",
  SETTINGS_USERS_MANAGE: "settings.users.manage",
  SETTINGS_ROLES_VIEW: "settings.roles.view",
  SETTINGS_ROLES_MANAGE: "settings.roles.manage",

  APPLICATIONS_VIEW: "applications.view",
  APPLICATIONS_MANAGE: "applications.manage",

  PROGRAMS_VIEW: "programs.view",
  PROGRAMS_MANAGE: "programs.manage",

  STAFF_VIEW: "staff.view",
  STAFF_MANAGE: "staff.manage",

  DONATIONS_VIEW: "donations.view",
  DONATIONS_MANAGE: "donations.manage",

  REPORTS_VIEW: "reports.view",
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

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

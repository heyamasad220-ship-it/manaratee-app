"use server"

import type { SupabaseClient } from "@supabase/supabase-js"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { isPlatformAdminOrgSupportSession } from "@/lib/platform/platform-org-access"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { createClient } from "@/lib/supabase/server"

export type DonationStaffAccessLevel = "view" | "manage"

export type DonationStaffContext = {
  supabase: SupabaseClient
  orgId: string
  userId: string
}

export type DonationStaffAccessResult =
  | ({ ok: true } & DonationStaffContext)
  | { ok: false; error: string }

async function membershipHasPermission(
  supabase: SupabaseClient,
  organizationId: string,
  membership: { role: string | null; role_id: string | null },
  permissionKey: string
) {
  if (await isPlatformAdminOrgSupportSession(organizationId)) {
    return true
  }

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
    console.error("Donation permission check error:", error)
    return false
  }

  return data?.enabled === true
}

export async function requireDonationStaffAccess(
  level: DonationStaffAccessLevel
): Promise<DonationStaffAccessResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "Not authenticated" }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { ok: false, error: "No organization selected" }
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("role, role_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (membershipError || !membership) {
    return { ok: false, error: "Unauthorized" }
  }

  const canManage = await membershipHasPermission(
    supabase,
    organizationId,
    membership,
    PERMISSIONS.DONATIONS_MANAGE
  )

  const canView =
    canManage ||
    (await membershipHasPermission(
      supabase,
      organizationId,
      membership,
      PERMISSIONS.DONATIONS_VIEW
    ))

  const allowed = level === "manage" ? canManage : canView

  if (!allowed) {
    return { ok: false, error: "Unauthorized" }
  }

  return {
    ok: true,
    supabase,
    orgId: organizationId,
    userId: user.id,
  }
}

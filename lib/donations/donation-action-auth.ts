import type { SupabaseClient } from "@supabase/supabase-js"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { isPlatformAdminOrgSupportSession } from "@/lib/platform/platform-org-access"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { createClient } from "@/lib/supabase/server"

export type DonationStaffAccessLevel =
  | "view"
  | "manage"
  | "campaigns"
  | "prospects"
  | "reports"

export type DonationStaffContext = {
  supabase: SupabaseClient
  orgId: string
  userId: string
  userEmail: string | null
  /** Full ledger / settings admin (`donations.manage`). */
  canManage: boolean
  /** Campaign workspace writes (`donations.manage` or `donations.campaigns.manage`). */
  canManageCampaigns: boolean
  /** Prospect pipeline writes (`donations.manage` or `donations.prospects.manage`). */
  canManageProspects: boolean
  /** Import / match ops (`donations.manage` or `donations.reports.manage`). */
  canManageReports: boolean
}

export type DonationStaffAccessResult =
  | ({ ok: true } & DonationStaffContext)
  | { ok: false; error: string }

function levelAllowed(
  level: DonationStaffAccessLevel,
  flags: {
    canManage: boolean
    canManageCampaigns: boolean
    canManageProspects: boolean
    canManageReports: boolean
    canView: boolean
  }
) {
  switch (level) {
    case "manage":
      return flags.canManage
    case "campaigns":
      return flags.canManageCampaigns
    case "prospects":
      return flags.canManageProspects
    case "reports":
      return flags.canManageReports
    case "view":
    default:
      return flags.canView
  }
}

export async function requireDonationStaffAccess(
  level: DonationStaffAccessLevel = "view"
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

  const platformSupport = await isPlatformAdminOrgSupportSession(organizationId)
  if (
    platformSupport ||
    membership.role === "owner" ||
    membership.role === "super_admin"
  ) {
    return {
      ok: true,
      supabase,
      orgId: organizationId,
      userId: user.id,
      userEmail: user.email ?? null,
      canManage: true,
      canManageCampaigns: true,
      canManageProspects: true,
      canManageReports: true,
    }
  }

  const permissionKeys = [
    PERMISSIONS.DONATIONS_MANAGE,
    PERMISSIONS.DONATIONS_VIEW,
    PERMISSIONS.DONATIONS_CAMPAIGNS_MANAGE,
    PERMISSIONS.DONATIONS_PROSPECTS_MANAGE,
    PERMISSIONS.DONATIONS_REPORTS_MANAGE,
  ] as const

  const enabledKeys = new Set<string>()
  if (membership.role_id) {
    const { data: permissionRows, error: permissionError } = await supabase
      .from("role_permissions")
      .select("permission_key, enabled")
      .eq("organization_id", organizationId)
      .eq("role_id", membership.role_id)
      .in("permission_key", [...permissionKeys])

    if (permissionError) {
      console.error("Donation permission check error:", permissionError)
    } else {
      for (const row of permissionRows || []) {
        if (row.enabled) enabledKeys.add(row.permission_key as string)
      }
    }
  }

  const canManage = enabledKeys.has(PERMISSIONS.DONATIONS_MANAGE)
  const canView = canManage || enabledKeys.has(PERMISSIONS.DONATIONS_VIEW)
  const canManageCampaigns =
    canManage || enabledKeys.has(PERMISSIONS.DONATIONS_CAMPAIGNS_MANAGE)
  const canManageProspects =
    canManage || enabledKeys.has(PERMISSIONS.DONATIONS_PROSPECTS_MANAGE)
  const canManageReports =
    canManage || enabledKeys.has(PERMISSIONS.DONATIONS_REPORTS_MANAGE)

  const allowed = levelAllowed(level, {
    canManage,
    canManageCampaigns,
    canManageProspects,
    canManageReports,
    canView,
  })

  if (!allowed) {
    return { ok: false, error: "Unauthorized" }
  }

  return {
    ok: true,
    supabase,
    orgId: organizationId,
    userId: user.id,
    userEmail: user.email ?? null,
    canManage,
    canManageCampaigns,
    canManageProspects,
    canManageReports,
  }
}

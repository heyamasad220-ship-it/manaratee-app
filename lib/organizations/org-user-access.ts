import { cookies } from "next/headers"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { isOrganizationSystemAdmin } from "@/lib/organizations/organization-system-admin"
import { isPlatformAdminOrgSupportSession } from "@/lib/platform/platform-org-access"
import { isPlatformAdminUserId } from "@/lib/platform/is-platform-admin-user"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { getEnabledPermissionKeys } from "@/lib/permissions/permissions"

export const ORG_USER_SUPPORT_USER_COOKIE = "org_user_support_user_id"
export const ORG_USER_SUPPORT_ORG_COOKIE = "org_user_support_org_id"

const supportCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 8,
}

export function getOrgUserSupportCookieOptions() {
  return supportCookieOptions
}

export type OrgUserSupportSession = {
  organizationId: string
  actingUserId: string
  actorUserId: string
}

export async function getOrgUserSupportTargetUserId() {
  const cookieStore = await cookies()
  return cookieStore.get(ORG_USER_SUPPORT_USER_COOKIE)?.value?.trim() || null
}

export async function getOrgUserSupportOrganizationId() {
  const cookieStore = await cookies()
  return cookieStore.get(ORG_USER_SUPPORT_ORG_COOKIE)?.value?.trim() || null
}

export async function clearOrgUserSupportCookies() {
  const cookieStore = await cookies()
  cookieStore.delete(ORG_USER_SUPPORT_USER_COOKIE)
  cookieStore.delete(ORG_USER_SUPPORT_ORG_COOKIE)
}

export async function isOrgUserSupportSession(organizationId?: string | null) {
  const actingUserId = await getOrgUserSupportTargetUserId()
  const supportOrgId = await getOrgUserSupportOrganizationId()

  if (!actingUserId || !supportOrgId) {
    return false
  }

  const activeOrgId = organizationId ?? supportOrgId
  if (activeOrgId !== supportOrgId) {
    return false
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return false
  }

  return true
}

export async function getOrgUserSupportSession(): Promise<OrgUserSupportSession | null> {
  const actingUserId = await getOrgUserSupportTargetUserId()
  const organizationId = await getOrgUserSupportOrganizationId()

  if (!actingUserId || !organizationId) {
    return null
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  return {
    organizationId,
    actingUserId,
    actorUserId: user.id,
  }
}

export async function canManageOrgUserSupport(organizationId: string) {
  if (await isPlatformAdminOrgSupportSession(organizationId)) {
    return true
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return false
  }

  const selectedOrgId = await getSelectedOrganizationId()
  if (selectedOrgId !== organizationId) {
    return false
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (isOrganizationSystemAdmin(membership?.role)) {
    return true
  }

  const { enabledPermissions } = await getEnabledPermissionKeys()
  return enabledPermissions.has(PERMISSIONS.SETTINGS_USERS_MANAGE)
}

export async function validateOrgUserSupportTarget(input: {
  organizationId: string
  targetUserId: string
  actorUserId: string
}) {
  const { organizationId, targetUserId, actorUserId } = input
  const trimmedOrgId = organizationId.trim()
  const trimmedTargetId = targetUserId.trim()

  if (!trimmedOrgId || !trimmedTargetId) {
    return { ok: false as const, error: "Organization and user are required." }
  }

  if (trimmedTargetId === actorUserId) {
    return { ok: false as const, error: "You cannot open the portal as yourself." }
  }

  if (!(await canManageOrgUserSupport(trimmedOrgId))) {
    return {
      ok: false as const,
      error: "You do not have permission to access user accounts for this organization.",
    }
  }

  const admin = getServiceRoleClient()

  if (await isPlatformAdminUserId(trimmedTargetId, admin)) {
    return { ok: false as const, error: "Platform admin accounts cannot be accessed." }
  }

  const { data: targetMembership } = await admin
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", trimmedOrgId)
    .eq("user_id", trimmedTargetId)
    .maybeSingle()

  if (
    targetMembership?.status === "active" &&
    isOrganizationSystemAdmin(targetMembership.role)
  ) {
    return {
      ok: false as const,
      error: "Organization admin accounts cannot be accessed from this feature.",
    }
  }

  const { data: contact } = await admin
    .from("contacts")
    .select("id")
    .eq("organization_id", trimmedOrgId)
    .eq("auth_user_id", trimmedTargetId)
    .maybeSingle()

  const hasMembership =
    targetMembership?.status === "active" || targetMembership?.status === "inactive"

  if (!contact && !hasMembership) {
    return {
      ok: false as const,
      error: "This user is not linked to the selected organization.",
    }
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, first_name, last_name, email")
    .eq("id", trimmedTargetId)
    .maybeSingle()

  if (!profile) {
    return { ok: false as const, error: "User account not found." }
  }

  const name =
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
    (profile.email as string | null) ||
    "User"

  return {
    ok: true as const,
    profile: {
      userId: trimmedTargetId,
      name,
      email: (profile.email as string | null) ?? null,
    },
  }
}

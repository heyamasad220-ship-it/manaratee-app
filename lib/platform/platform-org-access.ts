import { cookies } from "next/headers"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { isCurrentUserPlatformAdmin } from "@/lib/platform/is-platform-admin-user"

export const PLATFORM_ADMIN_ORG_ACCESS_COOKIE = "platform_admin_org_access"

const orgAccessCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 8,
}

export function getPlatformOrgAccessCookieOptions() {
  return orgAccessCookieOptions
}

export async function getPlatformAdminOrgAccessOrganizationId() {
  const cookieStore = await cookies()
  return cookieStore.get(PLATFORM_ADMIN_ORG_ACCESS_COOKIE)?.value?.trim() || null
}

export async function isPlatformAdminOrgSupportSession(
  organizationId?: string | null
) {
  const supportOrgId = await getPlatformAdminOrgAccessOrganizationId()
  if (!supportOrgId) {
    return false
  }

  const selectedOrganizationId =
    organizationId ?? (await getSelectedOrganizationId())

  if (!selectedOrganizationId || selectedOrganizationId !== supportOrgId) {
    return false
  }

  return isCurrentUserPlatformAdmin()
}

export async function clearPlatformAdminOrgAccessCookies() {
  const cookieStore = await cookies()
  cookieStore.delete(PLATFORM_ADMIN_ORG_ACCESS_COOKIE)
}

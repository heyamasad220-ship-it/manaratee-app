"use server"

import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { isCurrentUserPlatformAdmin } from "@/lib/platform/is-platform-admin-user"
import {
  getPlatformAdminOrgAccessOrganizationId,
  isPlatformAdminOrgSupportSession,
} from "@/lib/platform/platform-org-access"
import {
  getOrgUserSupportOrganizationId,
  isOrgUserSupportSession,
} from "@/lib/organizations/org-user-access"

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
}

export async function selectOrganization(organizationId: string) {
  const trimmedId = organizationId?.trim()

  if (!trimmedId) {
    throw new Error("Organization ID is required")
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error("Not authenticated")
  }

  let membershipQuery = supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("organization_id", trimmedId)
    .limit(1)

  const { data: activeMembership, error: activeMembershipError } =
    await membershipQuery.eq("status", "active").maybeSingle()

  if (activeMembershipError && activeMembershipError.code !== "42703") {
    throw new Error(activeMembershipError.message || "Could not verify organization membership")
  }

  if (!activeMembership) {
    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("organization_id", trimmedId)
      .maybeSingle()

    if (membershipError) {
      throw new Error(membershipError.message || "Could not verify organization membership")
    }

    if (!membership) {
      const isPlatformAdmin = await isCurrentUserPlatformAdmin()
      const supportOrgId = await getPlatformAdminOrgAccessOrganizationId()

      if (!(isPlatformAdmin && supportOrgId === trimmedId)) {
        throw new Error("You are not a member of this organization")
      }
    }
  }

  const cookieStore = await cookies()
  cookieStore.set("selected_organization_id", trimmedId, cookieOptions)

  return { success: true }
}

/** Customer portal org selection — validates via get_my_organizations (includes contact links). */
export async function setActiveOrganization(organizationId: string) {
  const trimmedId = organizationId?.trim()

  if (!trimmedId) {
    throw new Error("Organization ID is required")
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error("Not authenticated")
  }

  const supportOrgId = await getOrgUserSupportOrganizationId()
  if (supportOrgId && (await isOrgUserSupportSession(trimmedId))) {
    if (supportOrgId !== trimmedId) {
      throw new Error("You do not have access to this organization")
    }

    const cookieStore = await cookies()
    cookieStore.set("active_organization_id", trimmedId, cookieOptions)
    return { success: true }
  }

  const { data: organizations, error } = await supabase.rpc("get_my_organizations")

  if (error) {
    throw new Error(error.message || "Could not verify organization access")
  }

  const allowed = (organizations || []).some(
    (org: { organization_id: string }) => org.organization_id === trimmedId
  )

  if (!allowed) {
    throw new Error("You do not have access to this organization")
  }

  const cookieStore = await cookies()
  cookieStore.set("active_organization_id", trimmedId, cookieOptions)

  return { success: true }
}

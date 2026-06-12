"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import {
  ORG_USER_SUPPORT_ORG_COOKIE,
  ORG_USER_SUPPORT_USER_COOKIE,
  clearOrgUserSupportCookies,
  getOrgUserSupportCookieOptions,
  getOrgUserSupportSession,
  validateOrgUserSupportTarget,
} from "@/lib/organizations/org-user-access"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { createClient } from "@/lib/supabase/server"

const activeOrgCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
}

async function logOrgUserSupport(input: {
  organizationId: string
  actorUserId: string
  targetUserId: string
  action: "enter" | "exit"
}) {
  const admin = getServiceRoleClient()

  const { error } = await admin.from("organization_user_support_log").insert({
    organization_id: input.organizationId,
    actor_user_id: input.actorUserId,
    target_user_id: input.targetUserId,
    action: input.action,
  })

  if (error && error.code !== "42P01") {
    console.error("organization_user_support_log:", error)
  }
}

export async function enterCustomerPortalAsUser(
  organizationId: string,
  targetUserId: string
) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error("Not authenticated")
  }

  const validation = await validateOrgUserSupportTarget({
    organizationId,
    targetUserId,
    actorUserId: user.id,
  })

  if (!validation.ok) {
    throw new Error(validation.error)
  }

  await logOrgUserSupport({
    organizationId: organizationId.trim(),
    actorUserId: user.id,
    targetUserId: targetUserId.trim(),
    action: "enter",
  })

  const cookieStore = await cookies()
  const cookieOptions = getOrgUserSupportCookieOptions()

  cookieStore.set(
    ORG_USER_SUPPORT_USER_COOKIE,
    targetUserId.trim(),
    cookieOptions
  )
  cookieStore.set(
    ORG_USER_SUPPORT_ORG_COOKIE,
    organizationId.trim(),
    cookieOptions
  )
  cookieStore.set(
    "active_organization_id",
    organizationId.trim(),
    activeOrgCookieOptions
  )

  redirect("/customer/dashboard")
}

export async function exitOrgUserSupport() {
  const session = await getOrgUserSupportSession()

  if (session) {
    await logOrgUserSupport({
      organizationId: session.organizationId,
      actorUserId: session.actorUserId,
      targetUserId: session.actingUserId,
      action: "exit",
    })
  }

  const cookieStore = await cookies()
  await clearOrgUserSupportCookies()
  cookieStore.delete("active_organization_id")

  redirect("/settings/users")
}

export async function getOrgUserSupportSessionInfo() {
  const session = await getOrgUserSupportSession()
  if (!session) {
    return null
  }

  const validation = await validateOrgUserSupportTarget({
    organizationId: session.organizationId,
    targetUserId: session.actingUserId,
    actorUserId: session.actorUserId,
  })

  if (!validation.ok) {
    return null
  }

  const admin = getServiceRoleClient()
  const { data: org } = await admin
    .from("organizations")
    .select("id, name")
    .eq("id", session.organizationId)
    .maybeSingle()

  return {
    organizationId: session.organizationId,
    organizationName: (org?.name as string | undefined) ?? "Organization",
    targetUserId: session.actingUserId,
    targetUserName: validation.profile.name,
    targetUserEmail: validation.profile.email,
  }
}

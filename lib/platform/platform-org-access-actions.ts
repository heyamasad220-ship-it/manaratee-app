"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import {
  PLATFORM_ADMIN_ORG_ACCESS_COOKIE,
  clearPlatformAdminOrgAccessCookies,
  getPlatformAdminOrgAccessOrganizationId,
  getPlatformOrgAccessCookieOptions,
  isPlatformAdminOrgSupportSession,
} from "@/lib/platform/platform-org-access"
import { requirePlatformAdmin } from "@/lib/platform/require-platform-admin"

const selectedOrgCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
}

async function logPlatformOrgAccess(input: {
  userId: string
  organizationId: string
  action: "enter" | "exit"
}) {
  const admin = getServiceRoleClient()

  const { error } = await admin.from("platform_admin_org_access_log").insert({
    platform_admin_user_id: input.userId,
    organization_id: input.organizationId,
    action: input.action,
  })

  if (error && error.code !== "42P01") {
    console.error("platform_admin_org_access_log:", error)
  }
}

export async function enterOrganizationAsPlatformAdmin(organizationId: string) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) {
    throw new Error(auth.error)
  }

  const trimmedId = organizationId.trim()
  if (!trimmedId) {
    throw new Error("Organization ID is required")
  }

  const admin = auth.context.admin
  const userId = auth.context.userId

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id, name")
    .eq("id", trimmedId)
    .maybeSingle()

  if (orgError || !org) {
    throw new Error("Organization not found")
  }

  const { data: existingMembership } = await admin
    .from("organization_members")
    .select("id, role")
    .eq("organization_id", trimmedId)
    .eq("user_id", userId)
    .maybeSingle()

  if (!existingMembership) {
    let insertError = (
      await admin.from("organization_members").upsert(
        {
          organization_id: trimmedId,
          user_id: userId,
          role: "owner",
          status: "active",
          platform_support_access: true,
        },
        { onConflict: "organization_id,user_id" }
      )
    ).error

    if (insertError?.message?.includes("platform_support_access")) {
      insertError = (
        await admin.from("organization_members").upsert(
          {
            organization_id: trimmedId,
            user_id: userId,
            role: "owner",
            status: "active",
          },
          { onConflict: "organization_id,user_id" }
        )
      ).error
    }

    if (insertError) {
      throw new Error(insertError.message || "Could not create support membership")
    }
  }

  await logPlatformOrgAccess({
    userId,
    organizationId: trimmedId,
    action: "enter",
  })

  const cookieStore = await cookies()
  cookieStore.set("selected_organization_id", trimmedId, selectedOrgCookieOptions)
  cookieStore.set(
    PLATFORM_ADMIN_ORG_ACCESS_COOKIE,
    trimmedId,
    getPlatformOrgAccessCookieOptions()
  )

  redirect("/dashboard")
}

export async function exitPlatformAdminOrgAccess() {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) {
    throw new Error(auth.error)
  }

  const admin = auth.context.admin
  const userId = auth.context.userId
  const organizationId = await getPlatformAdminOrgAccessOrganizationId()

  if (organizationId) {
    await logPlatformOrgAccess({
      userId,
      organizationId,
      action: "exit",
    })

    const { error: deleteError } = await admin
      .from("organization_members")
      .delete()
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("platform_support_access", true)

    if (deleteError && deleteError.code !== "42703") {
      console.error("exitPlatformAdminOrgAccess delete membership:", deleteError)
    }
  }

  const cookieStore = await cookies()
  await clearPlatformAdminOrgAccessCookies()
  cookieStore.delete("selected_organization_id")

  redirect("/admin/organizations")
}

export async function getPlatformSupportSessionInfo() {
  const isSupportSession = await isPlatformAdminOrgSupportSession()
  if (!isSupportSession) {
    return null
  }

  const organizationId = await getPlatformAdminOrgAccessOrganizationId()
  if (!organizationId) {
    return null
  }

  const admin = getServiceRoleClient()
  const { data: org } = await admin
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle()

  return {
    organizationId,
    organizationName: (org?.name as string | undefined) ?? "Organization",
  }
}

import { NextRequest, NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { inviteAcceptRedirectUrl } from "@/lib/auth/auth-redirect"
import { getAppBaseUrl } from "@/lib/app/get-app-base-url"
import {
  DEFAULT_INVITED_MEMBER_SYSTEM_ROLE,
  invitedMemberSystemRoleCandidates,
  type OrganizationMemberSystemRole,
} from "@/lib/organizations/organization-member-constants"
import { syncProfileForOrganizationMember } from "@/lib/organizations/sync-profile-organization"

export const dynamic = "force-dynamic"

const MANAGE_USERS_PERMISSION = "settings.users.manage"

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status })
}

function resolveAppUrl(req: NextRequest) {
  return getAppBaseUrl(req)
}

function isExistingUserError(message?: string | null) {
  if (!message) return false
  const normalized = message.toLowerCase()
  return (
    normalized.includes("already been registered") ||
    normalized.includes("already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("email address has already been registered")
  )
}

async function findUserByEmail(admin: SupabaseClient, email: string) {
  let page = 1
  const perPage = 200

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw error
    }

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === email
    )
    if (match) {
      return match
    }

    if (data.users.length < perPage) {
      return null
    }

    page += 1
  }

  return null
}

async function upsertOrganizationMembership(
  admin: SupabaseClient,
  input: {
    organizationId: string
    userId: string
    roleId: string
    inviterSystemRole?: string | null
  }
) {
  const roleCandidates = invitedMemberSystemRoleCandidates(input.inviterSystemRole)
  let lastError: { message?: string; hint?: string; code?: string } | null = null

  for (const role of roleCandidates) {
    const payload: Record<string, unknown> = {
      organization_id: input.organizationId,
      user_id: input.userId,
      role,
      role_id: input.roleId,
      status: "active",
    }

    const { data, error } = await admin
      .from("organization_members")
      .upsert(payload, { onConflict: "organization_id,user_id" })
      .select("*")
      .single()

    if (!error) {
      return { data, error: null, roleUsed: role }
    }

    lastError = error

    const isRoleCheckFailure = error.message?.includes(
      "organization_members_role_check"
    )
    if (!isRoleCheckFailure) {
      return { data: null, error, roleUsed: role as OrganizationMemberSystemRole }
    }
  }

  return {
    data: null,
    error: lastError,
    roleUsed: DEFAULT_INVITED_MEMBER_SYSTEM_ROLE,
    attemptedRoles: roleCandidates,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const email = String(body.email || "")
      .trim()
      .toLowerCase()
    const organizationId = String(body.organizationId || "").trim()
    const roleId = String(body.roleId || "").trim()
    const roleName = String(body.roleName || "").trim()
    const firstName = String(body.firstName || "").trim()
    const lastName = String(body.lastName || "").trim()

    if (!email || !organizationId || !roleId) {
      return json(400, {
        success: false,
        error: "Missing required fields.",
        required: ["email", "organizationId", "roleId"],
      })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const appUrl = resolveAppUrl(req)

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Invite config missing", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
        appUrl,
      })

      return json(500, {
        success: false,
        error:
          "Server invite configuration is incomplete. Check SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL.",
      })
    }

    const supabaseUser = await createServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser()

    if (userError || !user) {
      return json(401, {
        success: false,
        error: "Unauthorized.",
      })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: currentMembership, error: currentMembershipError } = await admin
      .from("organization_members")
      .select("id, organization_id, user_id, role, role_id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (currentMembershipError) {
      console.error("Current membership lookup failed", currentMembershipError)
      return json(500, {
        success: false,
        error: currentMembershipError.message,
      })
    }

    if (!currentMembership) {
      return json(403, {
        success: false,
        error: "You are not a member of this organization.",
      })
    }

    const isSystemAdmin = ["owner", "admin", "super_admin", "coordinator"].includes(
      currentMembership.role
    )

    let canInvite = isSystemAdmin

    if (!canInvite && currentMembership.role_id) {
      const { data: invitePermission, error: invitePermissionError } = await admin
        .from("role_permissions")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("role_id", currentMembership.role_id)
        .eq("permission_key", MANAGE_USERS_PERMISSION)
        .eq("enabled", true)
        .maybeSingle()

      if (invitePermissionError) {
        console.error("Invite permission lookup failed", invitePermissionError)
        return json(500, {
          success: false,
          error: invitePermissionError.message,
        })
      }

      canInvite = Boolean(invitePermission)
    }

    if (!canInvite) {
      return json(403, {
        success: false,
        error:
          "You do not have permission to invite users. Enable Manage Users for your role.",
      })
    }

    const { data: invitedRole, error: invitedRoleError } = await admin
      .from("organization_roles")
      .select("id, name, organization_id")
      .eq("id", roleId)
      .eq("organization_id", organizationId)
      .single()

    if (invitedRoleError || !invitedRole) {
      return json(400, {
        success: false,
        error: "Invalid organization role.",
      })
    }

    const redirectTo = inviteAcceptRedirectUrl(appUrl)
    const inviteMetadata = {
      first_name: firstName,
      last_name: lastName,
      organization_id: organizationId,
      organization_role_id: roleId,
      organization_role_name: invitedRole.name || roleName,
    }

    let invitedUserId: string | null = null
    let emailSent = false
    let existingUser = false

    const { data: inviteData, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: inviteMetadata,
      })

    if (!inviteError && inviteData?.user?.id) {
      invitedUserId = inviteData.user.id
      emailSent = true
    } else if (isExistingUserError(inviteError?.message)) {
      existingUser = true
      const existingAuthUser = await findUserByEmail(admin, email)

      if (!existingAuthUser) {
        return json(502, {
          success: false,
          error: "This email is already registered, but the account could not be found.",
          details: inviteError?.message,
        })
      }

      invitedUserId = existingAuthUser.id

      const { error: otpError } = await admin.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      })

      if (otpError) {
        console.error("Existing user OTP email failed:", otpError.message)
      } else {
        emailSent = true
      }
    } else {
      console.error("SUPABASE INVITE ERROR:", {
        email,
        redirectTo,
        message: inviteError?.message,
        status: inviteError?.status,
        code: inviteError?.code,
      })

      return json(502, {
        success: false,
        error: "Failed to send invite email.",
        details: inviteError?.message,
        code: inviteError?.code,
      })
    }

    if (!invitedUserId) {
      return json(502, {
        success: false,
        error: "Could not resolve invited user account.",
      })
    }

    const { data: membership, error: membershipError, roleUsed, attemptedRoles } =
      await upsertOrganizationMembership(admin, {
        organizationId,
        userId: invitedUserId,
        roleId,
        inviterSystemRole: currentMembership.role,
      })

    if (membershipError) {
      console.error("MEMBERSHIP UPSERT FAILED:", membershipError)
      return json(500, {
        success: false,
        error: emailSent
          ? "Email sent, but adding the user to your organization failed."
          : "Could not add the user to your organization.",
        details: membershipError.message,
        hint: membershipError.hint,
        code: membershipError.code,
        attemptedRoles,
        fix:
          "Run scripts/014_organization_members_invite_support.sql in Supabase SQL Editor, then try again.",
      })
    }

    await syncProfileForOrganizationMember(admin, {
      userId: invitedUserId,
      email,
      firstName,
      lastName,
      organizationId,
      systemRole: roleUsed ?? DEFAULT_INVITED_MEMBER_SYSTEM_ROLE,
    })

    return json(200, {
      success: true,
      message: existingUser
        ? emailSent
          ? "User already had an account. They were added to your organization and sent a sign-in email."
          : "User already had an account and was added to your organization."
        : "Invitation email sent.",
      user: { id: invitedUserId, email },
      membership,
      existingUser,
      emailSent,
      memberSystemRole: roleUsed,
    })
  } catch (error: unknown) {
    console.error("Unhandled invite-user error", error)

    return json(500, {
      success: false,
      error: "Unexpected invite failure.",
      details: error instanceof Error ? error.message : String(error),
    })
  }
}

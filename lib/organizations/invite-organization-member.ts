import type { SupabaseClient } from "@supabase/supabase-js"
import { inviteAcceptRedirectUrl } from "@/lib/auth/auth-redirect"
import {
  DEFAULT_INVITED_MEMBER_SYSTEM_ROLE,
  invitedMemberSystemRoleCandidates,
  isCustomerPortalOrgRoleName,
  isCustomerPortalSystemRole,
  isOrganizationMemberSystemRole,
  PLATFORM_INVITED_MEMBER_SYSTEM_ROLE_FALLBACKS,
  type OrganizationMemberSystemRole,
} from "@/lib/organizations/organization-member-constants"
import { ORGANIZATION_SUPER_ADMIN_ROLE_NAME } from "@/lib/organizations/organization-system-roles"
import { syncProfileForOrganizationMember } from "@/lib/organizations/sync-profile-organization"
import { isPlatformAdminUserId as userIdIsPlatformAdmin } from "@/lib/platform/is-platform-admin-user"
import {
  getPlatformAdminUserIds,
  isPlatformAdminUserId,
  isPlatformOwnerEmail,
} from "@/lib/platform/platform-admin-users"

export type InviteOrganizationMemberInput = {
  email: string
  organizationId: string
  roleId?: string | null
  roleName?: string | null
  firstName?: string | null
  lastName?: string | null
  organizationName?: string | null
  inviterSystemRole?: string | null
  staffOnly?: boolean
  appUrl: string
}

export type InviteOrganizationMemberResult =
  | {
      success: true
      message: string
      user: { id: string; email: string }
      membership: Record<string, unknown>
      existingUser: boolean
      emailSent: boolean
      memberSystemRole: OrganizationMemberSystemRole
    }
  | {
      success: false
      status: number
      error: string
      details?: string
      hint?: string
      code?: string
      fix?: string
      attemptedRoles?: OrganizationMemberSystemRole[]
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
    roleId?: string | null
    inviterSystemRole?: string | null
    staffOnly?: boolean
    preferredSystemRole?: OrganizationMemberSystemRole | null
  }
) {
  const roleCandidates: OrganizationMemberSystemRole[] = []
  if (
    input.preferredSystemRole &&
    isOrganizationMemberSystemRole(input.preferredSystemRole)
  ) {
    roleCandidates.push(input.preferredSystemRole)
  }
  const fallbacks = input.staffOnly
    ? PLATFORM_INVITED_MEMBER_SYSTEM_ROLE_FALLBACKS
    : invitedMemberSystemRoleCandidates(input.inviterSystemRole)
  for (const role of fallbacks) {
    if (!roleCandidates.includes(role)) {
      roleCandidates.push(role)
    }
  }
  let lastError: { message?: string; hint?: string; code?: string } | null = null

  for (const role of roleCandidates) {
    const payload: Record<string, unknown> = {
      organization_id: input.organizationId,
      user_id: input.userId,
      role,
      status: "active",
    }

    if (input.roleId) {
      payload.role_id = input.roleId
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

export async function inviteOrganizationMember(
  admin: SupabaseClient,
  input: InviteOrganizationMemberInput
): Promise<InviteOrganizationMemberResult> {
  const email = input.email.trim().toLowerCase()
  const organizationId = input.organizationId.trim()
  const roleId = input.roleId?.trim() || null
  const firstName = input.firstName?.trim() || ""
  const lastName = input.lastName?.trim() || ""

  if (!email || !organizationId) {
    return {
      success: false,
      status: 400,
      error: "Email and organization are required.",
    }
  }

  if (isPlatformOwnerEmail(email)) {
    return {
      success: false,
      status: 400,
      error:
        "admin@manaratee.com is the platform owner, not an organization member. Invite a Super Admin at a different email.",
    }
  }

  let invitedRoleName = input.roleName?.trim() || null

  if (roleId) {
    const { data: invitedRole, error: invitedRoleError } = await admin
      .from("organization_roles")
      .select("id, name, organization_id")
      .eq("id", roleId)
      .eq("organization_id", organizationId)
      .single()

    if (invitedRoleError || !invitedRole) {
      return {
        success: false,
        status: 400,
        error: "Invalid organization role.",
      }
    }

    if (
      input.staffOnly &&
      isCustomerPortalOrgRoleName(invitedRole.name as string)
    ) {
      return {
        success: false,
        status: 400,
        error: "Platform admins can only invite organization staff roles.",
      }
    }

    invitedRoleName = invitedRole.name
  }

  const redirectTo = inviteAcceptRedirectUrl(input.appUrl, organizationId)
  const inviteMetadata: Record<string, string> = {
    organization_id: organizationId,
  }

  if (firstName) inviteMetadata.first_name = firstName
  if (lastName) inviteMetadata.last_name = lastName
  if (roleId) inviteMetadata.organization_role_id = roleId
  if (invitedRoleName) inviteMetadata.organization_role_name = invitedRoleName
  if (input.organizationName) {
    inviteMetadata.organization_name = input.organizationName
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
      return {
        success: false,
        status: 502,
        error:
          "This email is already registered, but the account could not be found.",
        details: inviteError?.message,
      }
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
    console.error("Organization invite error:", {
      email,
      redirectTo,
      message: inviteError?.message,
      status: inviteError?.status,
      code: inviteError?.code,
    })

    return {
      success: false,
      status: 502,
      error: "Failed to send invite email.",
      details: inviteError?.message,
      code: inviteError?.code,
    }
  }

  if (!invitedUserId) {
    return {
      success: false,
      status: 502,
      error: "Could not resolve invited user account.",
    }
  }

  if (await userIdIsPlatformAdmin(invitedUserId, admin)) {
    return {
      success: false,
      status: 400,
      error:
        "This account is a platform admin. Platform admins open organizations from Platform Admin, not as org Super Admins.",
    }
  }

  const { data: existingAuth } = await admin.auth.admin.getUserById(invitedUserId)
  const nextMetadata = {
    ...(existingAuth.user?.user_metadata ?? {}),
    ...inviteMetadata,
  }
  const { error: metadataError } = await admin.auth.admin.updateUserById(
    invitedUserId,
    { user_metadata: nextMetadata }
  )
  if (metadataError) {
    console.error("Invite user metadata update failed:", metadataError.message)
  }

  const {
    data: membership,
    error: membershipError,
    roleUsed,
    attemptedRoles,
  } = await upsertOrganizationMembership(admin, {
    organizationId,
    userId: invitedUserId,
    roleId,
    inviterSystemRole: input.inviterSystemRole ?? "admin",
    staffOnly: input.staffOnly === true,
    preferredSystemRole:
      invitedRoleName?.trim().toLowerCase() ===
      ORGANIZATION_SUPER_ADMIN_ROLE_NAME.toLowerCase()
        ? "super_admin"
        : null,
  })

  if (membershipError) {
    console.error("Membership upsert failed:", membershipError)
    return {
      success: false,
      status: 500,
      error: emailSent
        ? "Email sent, but adding the user to the organization failed."
        : "Could not add the user to the organization.",
      details: membershipError.message,
      hint: membershipError.hint,
      code: membershipError.code,
      attemptedRoles,
      fix: "Run scripts/014_organization_members_invite_support.sql in Supabase SQL Editor, then try again.",
    }
  }

  await syncProfileForOrganizationMember(admin, {
    userId: invitedUserId,
    email,
    firstName,
    lastName,
    organizationId,
    systemRole: roleUsed ?? DEFAULT_INVITED_MEMBER_SYSTEM_ROLE,
  })

  return {
    success: true,
    message: existingUser
      ? emailSent
        ? "User already had an account. They were added to the organization and sent a sign-in email."
        : "User already had an account and was added to the organization."
      : "Invitation email sent.",
    user: { id: invitedUserId, email },
    membership,
    existingUser,
    emailSent,
    memberSystemRole: roleUsed ?? DEFAULT_INVITED_MEMBER_SYSTEM_ROLE,
  }
}

import { getAppBaseUrl } from "@/lib/app/get-app-base-url"

export function resolveAppUrlFromRequest(req: Request) {
  return getAppBaseUrl(req)
}

function formatSystemRole(role?: string | null) {
  if (!role) return "Member"
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export async function listOrganizationMembers(
  admin: SupabaseClient,
  organizationId: string,
  options?: { staffOnly?: boolean }
) {
  const staffOnly = options?.staffOnly === true
  const platformAdminUserIds = await getPlatformAdminUserIds(admin)
  const { data: roles, error: rolesError } = await admin
    .from("organization_roles")
    .select("id, name, description")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })

  if (rolesError) {
    throw new Error(rolesError.message)
  }

  const { data: members, error: membersError } = await admin
    .from("organization_members")
    .select(
      "id, user_id, organization_id, role, role_id, status, created_at, platform_support_access"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })

  if (membersError) {
    throw new Error(membersError.message)
  }

  const userIds = (members || []).map((member) => member.user_id as string)
  let profiles: Array<{
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    updated_at: string | null
    created_at: string | null
  }> = []

  if (userIds.length > 0) {
    const { data: profileRows, error: profilesError } = await admin
      .from("profiles")
      .select("id, first_name, last_name, email, created_at, updated_at")
      .in("id", userIds)

    if (profilesError) {
      throw new Error(profilesError.message)
    }

    profiles = profileRows || []
  }

  const roleById = new Map((roles || []).map((role) => [role.id as string, role]))
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))

  const visibleRoles = staffOnly
    ? (roles || []).filter(
        (role) => !isCustomerPortalOrgRoleName(role.name as string)
      )
    : roles || []

  const formattedMembers = (members || [])
    .filter((member) => member.platform_support_access !== true)
    .map((member) => {
    const profile = profileById.get(member.user_id as string)
    const customRole = member.role_id
      ? roleById.get(member.role_id as string)
      : null
    const email = profile?.email ?? "No email found"
    const firstName = profile?.first_name?.trim() || ""
    const lastName = profile?.last_name?.trim() || ""
    const name = `${firstName} ${lastName}`.trim() || email

    return {
      membershipId: member.id as string,
      userId: member.user_id as string,
      name,
      firstName,
      lastName,
      email,
      systemRole: member.role as string,
      roleId: (member.role_id as string | null) ?? null,
      roleName:
        (customRole?.name as string | undefined) ??
        formatSystemRole(member.role as string),
      status:
        (member.status as string | null)?.toLowerCase() === "inactive"
          ? "Inactive"
          : "Active",
      lastLogin: profile?.updated_at ?? null,
      createdAt: profile?.created_at ?? (member.created_at as string),
    }
  })
    .filter((member) => {
      if (isPlatformAdminUserId(member.userId, platformAdminUserIds)) {
        return false
      }
      if (!staffOnly) return true
      if (isCustomerPortalSystemRole(member.systemRole)) return false
      if (isCustomerPortalOrgRoleName(member.roleName)) return false
      return true
    })

  return {
    members: formattedMembers,
    roles: visibleRoles,
  }
}

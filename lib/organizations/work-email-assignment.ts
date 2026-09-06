"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  ORGANIZATION_AUDIT_ACTIONS,
  writeOrganizationAuditLog,
} from "@/lib/audit/organization-audit-log"
import { getAppBaseUrl } from "@/lib/app/get-app-base-url"
import { canManageDepartment } from "@/lib/departments/department-access"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { inviteOrganizationMember } from "@/lib/organizations/invite-organization-member"
import {
  isCustomerPortalOrgRoleName,
  isCustomerPortalSystemRole,
} from "@/lib/organizations/organization-member-constants"
import { ORGANIZATION_ADMIN_ROLE_NAME } from "@/lib/organizations/organization-system-roles"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export type WorkLoginAssignment = {
  membershipId: string
  userId: string
  email: string
  name: string
  assignedContactId: string | null
  assignedContactName: string | null
  assignedContactEmail: string | null
}

function contactLabel(name: string | null | undefined, email: string | null | undefined) {
  const cleanName = String(name || "").trim()
  const cleanEmail = String(email || "").trim()
  if (cleanName && cleanEmail) return `${cleanName} (${cleanEmail})`
  return cleanName || cleanEmail || "Unnamed"
}

async function requireWorkEmailManager(departmentId?: string | null) {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { ok: false as const, error: "No organization selected." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false as const, error: "Not authenticated." }
  }

  const canManageUsers = await hasPermission(PERMISSIONS.SETTINGS_USERS_MANAGE)
  const canManageStaff = await hasPermission(PERMISSIONS.STAFF_MANAGE)
  const canManageDept = departmentId ? await canManageDepartment(departmentId) : false

  if (!canManageUsers && !canManageStaff && !canManageDept) {
    return {
      ok: false as const,
      error: "You do not have permission to assign work emails.",
    }
  }

  return {
    ok: true as const,
    organizationId,
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    admin: createServiceRoleClient(),
  }
}

export async function loadWorkLoginAssignmentForContact(
  admin: SupabaseClient,
  organizationId: string,
  contactId: string
): Promise<WorkLoginAssignment | null> {
  const { data: membership } = await admin
    .from("organization_members")
    .select("id, user_id, assigned_contact_id")
    .eq("organization_id", organizationId)
    .eq("assigned_contact_id", contactId)
    .maybeSingle()

  if (!membership?.id) return null

  const { data: profile } = await admin
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", membership.user_id as string)
    .maybeSingle()

  const { data: contact } = await admin
    .from("contacts")
    .select("full_name, email")
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const firstName = profile?.first_name?.trim() || ""
  const lastName = profile?.last_name?.trim() || ""
  const email = (profile?.email as string | null)?.trim() || "No email"

  return {
    membershipId: membership.id as string,
    userId: membership.user_id as string,
    email,
    name: `${firstName} ${lastName}`.trim() || email,
    assignedContactId: contactId,
    assignedContactName: (contact?.full_name as string | null) ?? null,
    assignedContactEmail: (contact?.email as string | null) ?? null,
  }
}

async function findOrgMembershipByEmail(
  admin: SupabaseClient,
  organizationId: string,
  email: string
) {
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, first_name, last_name")
    .ilike("email", email.replace(/[%_\\]/g, "\\$&"))

  const matches = (profiles || []).filter(
    (row) => normalizeEmail(String(row.email || "")) === email
  )
  if (matches.length === 0) return null

  const userIds = matches.map((row) => row.id as string)
  const { data: members } = await admin
    .from("organization_members")
    .select("id, user_id, assigned_contact_id, role, platform_support_access")
    .eq("organization_id", organizationId)
    .in("user_id", userIds)

  const member = (members || []).find((row) => !row.platform_support_access)
  if (!member) return null

  const profile =
    matches.find((row) => row.id === member.user_id) || matches[0]

  return { member, profile }
}

async function loadAdminRoleId(admin: SupabaseClient, organizationId: string) {
  const { data: adminRole } = await admin
    .from("organization_roles")
    .select("id")
    .eq("organization_id", organizationId)
    .ilike("name", ORGANIZATION_ADMIN_ROLE_NAME)
    .maybeSingle()

  if (adminRole?.id) return adminRole.id as string

  const { data: fallback } = await admin
    .from("organization_roles")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(8)

  const staffRole = (fallback || []).find(
    (row) => !isCustomerPortalOrgRoleName(String(row.name || ""))
  )
  return (staffRole?.id as string | undefined) ?? null
}

export async function listStaffWorkLoginsAction(): Promise<
  | { success: true; logins: WorkLoginAssignment[] }
  | { success: false; error: string }
> {
  const access = await requireWorkEmailManager()
  if (!access.ok) return { success: false, error: access.error }

  const { data: members, error } = await access.admin
    .from("organization_members")
    .select("id, user_id, assigned_contact_id, role, platform_support_access")
    .eq("organization_id", access.organizationId)
    .eq("platform_support_access", false)
    .neq("role", "viewer")
    .order("created_at", { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  const rows = members || []
  const userIds = rows.map((row) => row.user_id as string)
  const contactIds = rows
    .map((row) => row.assigned_contact_id as string | null)
    .filter((id): id is string => Boolean(id))

  const [{ data: profiles }, { data: contacts }] = await Promise.all([
    userIds.length
      ? access.admin
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", userIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    contactIds.length
      ? access.admin
          .from("contacts")
          .select("id, full_name, email")
          .eq("organization_id", access.organizationId)
          .in("id", contactIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ])

  const profileById = new Map((profiles || []).map((row) => [row.id as string, row]))
  const contactById = new Map((contacts || []).map((row) => [row.id as string, row]))

  return {
    success: true,
    logins: rows.map((row) => {
      const profile = profileById.get(row.user_id as string)
      const assignedId = (row.assigned_contact_id as string | null) ?? null
      const contact = assignedId ? contactById.get(assignedId) : null
      const firstName = String(profile?.first_name || "").trim()
      const lastName = String(profile?.last_name || "").trim()
      const email = String(profile?.email || "").trim() || "No email"
      return {
        membershipId: row.id as string,
        userId: row.user_id as string,
        email,
        name: `${firstName} ${lastName}`.trim() || email,
        assignedContactId: assignedId,
        assignedContactName: (contact?.full_name as string | null) ?? null,
        assignedContactEmail: (contact?.email as string | null) ?? null,
      }
    }),
  }
}

export async function assignWorkLoginToContactAction(input: {
  membershipId: string
  contactId: string | null
  departmentId?: string | null
}): Promise<{ success: true } | { success: false; error: string }> {
  const access = await requireWorkEmailManager(input.departmentId)
  if (!access.ok) return { success: false, error: access.error }

  const membershipId = input.membershipId.trim()
  if (!membershipId) {
    return { success: false, error: "Choose a work email / user login." }
  }

  const { data: membership, error: membershipError } = await access.admin
    .from("organization_members")
    .select("id, user_id, assigned_contact_id, role")
    .eq("id", membershipId)
    .eq("organization_id", access.organizationId)
    .maybeSingle()

  if (membershipError || !membership) {
    return { success: false, error: "Work email login was not found." }
  }

  if ((membership.role as string) === "viewer") {
    return { success: false, error: "Customer logins cannot be used as work emails." }
  }

  const previousContactId = (membership.assigned_contact_id as string | null) ?? null
  const nextContactId = input.contactId?.trim() || null

  if (previousContactId === nextContactId) {
    return { success: true }
  }

  let nextContactName = "Unassigned"
  let nextContactEmail: string | null = null

  if (nextContactId) {
    const { data: contact, error: contactError } = await access.admin
      .from("contacts")
      .select("id, full_name, email, contact_type")
      .eq("id", nextContactId)
      .eq("organization_id", access.organizationId)
      .maybeSingle()

    if (contactError || !contact) {
      return { success: false, error: "Directory person was not found." }
    }

    if ((contact.contact_type as string | null) && contact.contact_type !== "individual") {
      return { success: false, error: "Work emails can only be assigned to a person." }
    }

    nextContactName = String(contact.full_name || "").trim() || "Unnamed"
    nextContactEmail = (contact.email as string | null) ?? null

    const { error: clearError } = await access.admin
      .from("organization_members")
      .update({ assigned_contact_id: null, updated_at: new Date().toISOString() })
      .eq("organization_id", access.organizationId)
      .eq("assigned_contact_id", nextContactId)
      .neq("id", membershipId)

    if (clearError) {
      return { success: false, error: clearError.message }
    }
  }

  const { error: updateError } = await access.admin
    .from("organization_members")
    .update({
      assigned_contact_id: nextContactId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", membershipId)
    .eq("organization_id", access.organizationId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  const { data: profile } = await access.admin
    .from("profiles")
    .select("email, first_name, last_name")
    .eq("id", membership.user_id as string)
    .maybeSingle()

  const workEmail = String(profile?.email || "").trim() || "work email"
  const workName =
    `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || workEmail

  await writeOrganizationAuditLog({
    organizationId: access.organizationId,
    category: "permission",
    action: ORGANIZATION_AUDIT_ACTIONS.MEMBER_WORK_EMAIL_ASSIGNED,
    actorUserId: access.actorUserId,
    actorEmail: access.actorEmail,
    targetType: "member",
    targetId: membership.user_id as string,
    targetLabel: workName,
    summary: nextContactId
      ? `Assigned work email ${workEmail} to ${contactLabel(nextContactName, nextContactEmail)}`
      : `Unassigned work email ${workEmail}`,
    metadata: {
      membership_id: membershipId,
      previous_contact_id: previousContactId,
      new_contact_id: nextContactId,
      work_email: workEmail,
    },
  })

  revalidatePath("/settings/users")
  revalidatePath("/settings/audit-log")
  revalidatePath("/workforce/employees")
  if (input.departmentId) {
    revalidatePath(workforceDepartmentDetailPath(input.departmentId))
  }

  return { success: true }
}

export async function unassignWorkLoginForContactAction(input: {
  contactId: string
  departmentId?: string | null
}): Promise<{ success: true } | { success: false; error: string }> {
  const access = await requireWorkEmailManager(input.departmentId)
  if (!access.ok) return { success: false, error: access.error }

  const assignment = await loadWorkLoginAssignmentForContact(
    access.admin,
    access.organizationId,
    input.contactId
  )
  if (!assignment) return { success: true }

  return assignWorkLoginToContactAction({
    membershipId: assignment.membershipId,
    contactId: null,
    departmentId: input.departmentId,
  })
}

export async function setContactWorkEmailAction(input: {
  contactId: string
  email: string | null
  departmentId?: string | null
  firstName?: string | null
  lastName?: string | null
  confirmReassign?: boolean
}): Promise<
  | { success: true; invited: boolean }
  | {
      success: false
      error: string
      needsConfirm?: boolean
      assignedToName?: string
    }
> {
  const access = await requireWorkEmailManager(input.departmentId)
  if (!access.ok) return { success: false, error: access.error }

  const contactId = input.contactId.trim()
  if (!contactId) {
    return { success: false, error: "This employee is not linked to a contact." }
  }

  const email = input.email ? normalizeEmail(input.email) : ""
  if (!email) {
    const cleared = await unassignWorkLoginForContactAction({
      contactId,
      departmentId: input.departmentId,
    })
    if (!cleared.success) return cleared
    return { success: true, invited: false }
  }

  if (!isValidEmail(email)) {
    return { success: false, error: "Enter a valid work email address." }
  }

  const { data: contact, error: contactError } = await access.admin
    .from("contacts")
    .select("id, email, full_name, contact_type")
    .eq("id", contactId)
    .eq("organization_id", access.organizationId)
    .maybeSingle()

  if (contactError || !contact) {
    return { success: false, error: "Directory person was not found." }
  }

  if ((contact.contact_type as string | null) && contact.contact_type !== "individual") {
    return { success: false, error: "Work emails can only be assigned to a person." }
  }

  const personalEmail = normalizeEmail(String(contact.email || ""))
  if (personalEmail && personalEmail === email) {
    return {
      success: false,
      error:
        "Work email must be different from this person's personal email (used for My Account).",
    }
  }

  const existing = await findOrgMembershipByEmail(
    access.admin,
    access.organizationId,
    email
  )

  if (existing) {
    if (isCustomerPortalSystemRole(String(existing.member.role || ""))) {
      return {
        success: false,
        error:
          "That email is a personal / customer login. Use a different work mailbox.",
      }
    }

    const previousContactId =
      (existing.member.assigned_contact_id as string | null) ?? null
    if (previousContactId && previousContactId !== contactId && !input.confirmReassign) {
      const { data: other } = await access.admin
        .from("contacts")
        .select("full_name")
        .eq("id", previousContactId)
        .eq("organization_id", access.organizationId)
        .maybeSingle()
      const assignedToName =
        String(other?.full_name || "").trim() || "another person"
      return {
        success: false,
        error: `${email} is currently assigned to ${assignedToName}. Move it to this employee?`,
        needsConfirm: true,
        assignedToName,
      }
    }

    const assigned = await assignWorkLoginToContactAction({
      membershipId: existing.member.id as string,
      contactId,
      departmentId: input.departmentId,
    })
    if (!assigned.success) return assigned
    return { success: true, invited: false }
  }

  const currentAssignment = await loadWorkLoginAssignmentForContact(
    access.admin,
    access.organizationId,
    contactId
  )
  if (currentAssignment && normalizeEmail(currentAssignment.email) === email) {
    return { success: true, invited: false }
  }

  const roleId = await loadAdminRoleId(access.admin, access.organizationId)
  if (!roleId) {
    return {
      success: false,
      error: "Could not find an Admin role to invite this work email.",
    }
  }

  const { data: actorMembership } = await access.admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", access.organizationId)
    .eq("user_id", access.actorUserId)
    .maybeSingle()

  const firstName =
    input.firstName?.trim() ||
    String(contact.full_name || "").trim().split(/\s+/)[0] ||
    ""
  const lastName =
    input.lastName?.trim() ||
    String(contact.full_name || "").trim().split(/\s+/).slice(1).join(" ") ||
    ""

  const invited = await inviteOrganizationMember(access.admin, {
    email,
    organizationId: access.organizationId,
    roleId,
    firstName,
    lastName,
    inviterSystemRole: (actorMembership?.role as string | null) ?? "admin",
    staffOnly: true,
    appUrl: getAppBaseUrl(),
  })

  if (!invited.success) {
    return { success: false, error: invited.error }
  }

  const membershipId = String(invited.membership?.id || "")
  if (!membershipId) {
    return {
      success: false,
      error:
        "Invitation sent, but the work email could not be assigned. Finish assigning it in Settings → Users.",
    }
  }

  const assigned = await assignWorkLoginToContactAction({
    membershipId,
    contactId,
    departmentId: input.departmentId,
  })
  if (!assigned.success) return assigned
  return { success: true, invited: true }
}

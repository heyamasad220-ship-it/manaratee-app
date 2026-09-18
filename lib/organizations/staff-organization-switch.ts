"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { isOrgStaffSystemRole } from "@/lib/organizations/organization-member-constants"
import { selectOrganization } from "@/lib/organizations/organization-actions"

export type StaffOrganizationOption = {
  organizationId: string
  organizationName: string
  roleLabel: string
}

export type SwitchStaffOrganizationResult =
  | { success: true }
  | { success: false; error: string }

type MembershipRow = {
  organization_id: string
  role: string | null
  status?: string | null
  platform_support_access?: boolean | null
  organization_roles?: { name?: string | null } | { name?: string | null }[] | null
  organizations?: { id?: string; name?: string | null } | { id?: string; name?: string | null }[] | null
}

function firstJoinedRecord<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function staffRoleLabel(systemRole: string, roleName: string | null | undefined) {
  const named = roleName?.trim()
  if (named) return named

  if (systemRole === "super_admin") return "Super Admin"
  if (systemRole === "admin") return "Admin"
  if (systemRole === "coordinator") return "Coordinator"
  if (systemRole === "owner") return "Owner"
  return systemRole
}

export async function listStaffOrganizationsAction(): Promise<StaffOrganizationOption[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  let query = supabase
    .from("organization_members")
    .select(
      "organization_id, role, status, platform_support_access, organization_roles:role_id(name), organizations:organization_id(id, name)"
    )
    .eq("user_id", user.id)

  let { data, error } = await query

  if (error?.code === "42703") {
    const fallback = await supabase
      .from("organization_members")
      .select(
        "organization_id, role, organizations:organization_id(id, name)"
      )
      .eq("user_id", user.id)

    data = fallback.data as MembershipRow[] | null
    error = fallback.error
  }

  if (error) {
    console.error("listStaffOrganizationsAction:", error)
    return []
  }

  const byOrgId = new Map<string, StaffOrganizationOption>()

  for (const row of (data || []) as MembershipRow[]) {
    const organizationId = row.organization_id?.trim()
    const systemRole = row.role?.trim() || ""
    const organization = firstJoinedRecord(row.organizations)
    const organizationName = organization?.name?.trim() || ""
    const roleName = firstJoinedRecord(row.organization_roles)?.name

    if (!organizationId || !organizationName) continue
    if (row.platform_support_access === true) continue
    if (row.status && row.status !== "active") continue
    if (!isOrgStaffSystemRole(systemRole)) continue

    byOrgId.set(organizationId, {
      organizationId,
      organizationName,
      roleLabel: staffRoleLabel(systemRole, roleName),
    })
  }

  return [...byOrgId.values()].sort((left, right) =>
    left.organizationName.localeCompare(right.organizationName, undefined, {
      sensitivity: "base",
    })
  )
}

export async function switchStaffOrganizationAction(
  organizationId: string
): Promise<SwitchStaffOrganizationResult> {
  const trimmedId = organizationId?.trim()

  if (!trimmedId) {
    return { success: false, error: "Organization ID is required" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  let { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("role, status, platform_support_access")
    .eq("user_id", user.id)
    .eq("organization_id", trimmedId)
    .maybeSingle()

  if (membershipError?.code === "42703") {
    const fallback = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", trimmedId)
      .maybeSingle()
    membership = fallback.data as typeof membership
    membershipError = fallback.error
  }

  if (membershipError) {
    return {
      success: false,
      error: membershipError.message || "Could not verify organization membership",
    }
  }

  const role = (membership?.role as string | undefined)?.trim() || ""
  const status = (membership?.status as string | undefined | null) ?? "active"
  const platformSupport = membership?.platform_support_access === true

  if (!membership || platformSupport || (status && status !== "active") || !isOrgStaffSystemRole(role)) {
    return { success: false, error: "You do not have staff access to that organization" }
  }

  try {
    await selectOrganization(trimmedId)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not switch organization",
    }
  }

  try {
    await supabase.auth.updateUser({
      data: {
        ...((user.user_metadata as Record<string, unknown> | null) ?? {}),
        organization_id: trimmedId,
      },
    })
  } catch (error) {
    console.warn("Could not persist preferred organization on the user:", error)
  }

  revalidatePath("/", "layout")
  revalidatePath("/dashboard")

  return { success: true }
}

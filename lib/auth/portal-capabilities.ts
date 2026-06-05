import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  ORG_ADMIN_DASHBOARD_ROLES,
} from "@/lib/organizations/organization-member-constants"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { getStaffAssignmentsForCurrentContact } from "@/lib/programs/program-staff-assignment-queries"
import type { UserPortalCapabilities } from "@/lib/auth/portal-capabilities-types"

export type { UserPortalCapabilities }

function isOrgAdminDashboardRole(role: string | null | undefined) {
  return ORG_ADMIN_DASHBOARD_ROLES.includes(
    role as (typeof ORG_ADMIN_DASHBOARD_ROLES)[number]
  )
}

export async function getUserPortalCapabilities(
  userId: string,
  organizationId?: string | null
): Promise<UserPortalCapabilities> {
  const supabase = await createClient()
  const orgId = organizationId ?? (await getSelectedOrganizationId())

  if (!orgId) {
    return {
      hasPersonalPortal: false,
      hasTeachingPortal: false,
      hasAdminPortal: false,
    }
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, role_id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()

  let hasAdminPanel = false

  if (membership?.role_id) {
    const { data: permissionRows } = await supabase
      .from("role_permissions")
      .select("permission_key")
      .eq("role_id", membership.role_id)
      .in("permission_key", [
        PERMISSIONS.PROGRAMS_MANAGE,
        PERMISSIONS.PROGRAMS_VIEW,
      ])

    hasAdminPanel = Boolean(permissionRows?.length)
  }

  if (!hasAdminPanel && membership?.role) {
    hasAdminPanel = isOrgAdminDashboardRole(membership.role)
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("auth_user_id", userId)
    .maybeSingle()

  const teachingAssignments = contact?.id
    ? await getStaffAssignmentsForCurrentContact(orgId, userId)
    : []

  const hasTeachingPortal = teachingAssignments.length > 0
  const hasPersonalPortal = Boolean(contact?.id) || membership?.role === "viewer"

  return {
    hasPersonalPortal,
    hasTeachingPortal,
    hasAdminPortal: hasAdminPanel,
  }
}

export async function userCanAccessOfferingRoster(input: {
  userId: string
  organizationId: string
  offeringId: string
}) {
  const capabilities = await getUserPortalCapabilities(
    input.userId,
    input.organizationId
  )

  if (capabilities.hasAdminPortal) {
    return true
  }

  const assignments = await getStaffAssignmentsForCurrentContact(
    input.organizationId,
    input.userId
  )

  return assignments.some(
    (assignment) =>
      assignment.offering_id === input.offeringId && assignment.is_active
  )
}

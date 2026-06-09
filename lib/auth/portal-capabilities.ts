import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getStaffAssignmentsForCurrentContact } from "@/lib/programs/program-staff-assignment-queries"
import type { UserPortalCapabilities } from "@/lib/auth/portal-capabilities-types"
import { resolvePortalPermissions } from "@/lib/auth/resolve-portal-permissions"
import { resolveStaffToolsPortalAccess } from "@/lib/auth/staff-tools-eligibility"

export type { UserPortalCapabilities } from "@/lib/auth/portal-capabilities-types"

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
      hasStaffToolsPortal: false,
      canManageEventRequests: false,
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

  const portalPermissions = await resolvePortalPermissions(
    supabase,
    orgId,
    membership
  )

  const hasStaffToolsPortal = await resolveStaffToolsPortalAccess(
    supabase,
    orgId,
    userId,
    membership,
    contact?.id
  )

  return {
    hasPersonalPortal,
    hasTeachingPortal,
    hasStaffToolsPortal,
    canManageEventRequests: portalPermissions.canManageEventRequests,
    hasAdminPortal: portalPermissions.hasAdminPortal,
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

export async function requireStaffToolsPortal(
  userId: string,
  organizationId: string
) {
  const capabilities = await getUserPortalCapabilities(userId, organizationId)
  return capabilities.hasStaffToolsPortal
}

import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { resolveStaffIdentityForUser } from "@/lib/organizations/work-email-lookups"
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

  const admin = createServiceRoleClient()

  const { data: membership } = await admin
    .from("organization_members")
    .select("role, role_id, assigned_contact_id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()

  const identity = await resolveStaffIdentityForUser(admin, orgId, userId)

  const teachingContactId = identity.staffContactId || identity.personalContactId
  const teachingAssignments = teachingContactId
    ? await getStaffAssignmentsForCurrentContact(orgId, userId)
    : []

  const hasTeachingPortal = teachingAssignments.length > 0
  const hasPersonalPortal = identity.isWorkLogin
    ? false
    : Boolean(identity.personalContactId) || membership?.role === "viewer"

  const portalPermissions = await resolvePortalPermissions(
    supabase,
    orgId,
    membership
  )

  const hasStaffToolsPortal = await resolveStaffToolsPortalAccess(
    admin,
    orgId,
    userId,
    membership,
    identity.staffContactId
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

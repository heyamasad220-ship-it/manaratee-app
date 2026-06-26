import { redirect } from "next/navigation"

import { getCurrentUserPermissionContext } from "@/lib/permissions/permissions"
import {
  canViewOrganizationBilling,
  isOrganizationSuperAdminRoleName,
  isOrganizationSuperAdminSystemRole,
} from "@/lib/organizations/organization-system-admin"
import { isPlatformAdminOrgSupportSession } from "@/lib/platform/platform-org-access"

export {
  canViewOrganizationBilling,
  isOrganizationSuperAdminRoleName,
  isOrganizationSuperAdminSystemRole,
} from "@/lib/organizations/organization-system-admin"

async function resolveOrganizationRoleName(
  supabase: Awaited<ReturnType<typeof getCurrentUserPermissionContext>>["supabase"],
  organizationId: string,
  roleId: string | null
) {
  if (!roleId) return null

  const { data } = await supabase
    .from("organization_roles")
    .select("name")
    .eq("organization_id", organizationId)
    .eq("id", roleId)
    .maybeSingle()

  return (data?.name as string | null) ?? null
}

export async function requireOrganizationSuperAdmin() {
  const context = await getCurrentUserPermissionContext()
  const { supabase, membership, organizationId, user } = context

  const platformSupport = await isPlatformAdminOrgSupportSession(organizationId)
  const organizationRoleName = await resolveOrganizationRoleName(
    supabase,
    organizationId,
    membership.role_id
  )

  if (
    !canViewOrganizationBilling({
      systemRole: membership.role,
      organizationRoleName,
      platformSupport,
    })
  ) {
    redirect("/unauthorized")
  }

  return {
    supabase,
    organizationId,
    membership,
    userId: user.id,
    platformSupport,
    organizationRoleName,
  }
}

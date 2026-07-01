import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasPermission } from "@/lib/permissions/permissions"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function requireContactsViewAccess() {
  const canView = await hasPermission(PERMISSIONS.CONTACTS_VIEW)
  if (!canView) {
    return { ok: false as const, error: "You do not have permission to view contacts." }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { ok: false as const, error: "No organization selected." }
  }

  const supabase = createServiceRoleClient()
  return { ok: true as const, supabase, organizationId }
}

export async function requireContactsManageAccess() {
  const canManage = await hasPermission(PERMISSIONS.CONTACTS_MANAGE)
  if (!canManage) {
    return { ok: false as const, error: "You do not have permission to manage contacts." }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { ok: false as const, error: "No organization selected." }
  }

  const supabase = createServiceRoleClient()
  return { ok: true as const, supabase, organizationId }
}

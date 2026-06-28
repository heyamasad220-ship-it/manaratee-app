"use server"

import {
  fetchGroupMembers,
  formatGroupMemberActionError,
} from "@/lib/contacts/group-membership-data"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasPermission } from "@/lib/permissions/permissions"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function fetchGroupMembersAction(groupContactId: string) {
  try {
    const canView = await hasPermission(PERMISSIONS.CONTACTS_VIEW)
    if (!canView) {
      return { success: false as const, error: "You do not have permission to view contacts." }
    }

    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false as const, error: "No organization selected." }
    }

    const supabase = createServiceRoleClient()
    return await fetchGroupMembers(supabase, organizationId, groupContactId)
  } catch (error) {
    return {
      success: false as const,
      error: formatGroupMemberActionError(error, "Could not load group members."),
    }
  }
}

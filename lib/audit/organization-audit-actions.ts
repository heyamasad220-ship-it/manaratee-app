"use server"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasAnyPermission } from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"
import type {
  OrganizationAuditCategory,
  OrganizationAuditLogRow,
} from "@/lib/audit/organization-audit-log"

export type OrganizationAuditLogFilters = {
  category?: OrganizationAuditCategory | "all"
  search?: string
  limit?: number
}

export async function fetchOrganizationAuditLogsAction(
  filters: OrganizationAuditLogFilters = {}
): Promise<{ success: true; logs: OrganizationAuditLogRow[] } | { success: false; error: string }> {
  const allowed = await hasAnyPermission(
    PERMISSIONS.SETTINGS_USERS_VIEW,
    PERMISSIONS.SETTINGS_ROLES_VIEW,
    PERMISSIONS.DONATIONS_VIEW,
    PERMISSIONS.DONATIONS_MANAGE
  )

  if (!allowed) {
    return { success: false, error: "Not authorized to view audit logs." }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const supabase = await createClient()
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500)

  let query = supabase
    .from("organization_audit_logs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (filters.category && filters.category !== "all") {
    query = query.eq("category", filters.category)
  }

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  let logs = (data ?? []) as OrganizationAuditLogRow[]

  const search = filters.search?.trim().toLowerCase()
  if (search) {
    logs = logs.filter((log) => {
      const haystack = [
        log.summary,
        log.action,
        log.target_label,
        log.actor_display_name,
        log.actor_email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(search)
    })
  }

  return { success: true, logs }
}

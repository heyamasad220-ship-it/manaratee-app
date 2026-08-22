"use server"

import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { createClient } from "@/lib/supabase/server"

function escapeIlike(value: string) {
  return value.replace(/[%_\\,]/g, "\\$&")
}

/** Search individual contacts for HR role assignment (employee / volunteer). */
export async function searchContactsForHrPickerAction(search: string, limit = 30) {
  const canView =
    (await hasPermission(PERMISSIONS.CONTACTS_VIEW)) ||
    (await hasPermission(PERMISSIONS.STAFF_VIEW)) ||
    (await hasPermission(PERMISSIONS.MEMBERSHIP_VIEW)) ||
    (await hasPermission(PERMISSIONS.MEMBERSHIP_MANAGE))

  if (!canView) {
    return { success: false as const, error: "You do not have permission to search contacts." }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false as const, error: "No organization selected." }
  }

  const supabase = await createClient()
  let query = supabase
    .from("contacts")
    .select("id, full_name, email, phone, contact_type")
    .eq("organization_id", organizationId)
    .eq("contact_type", "individual")
    .order("full_name", { ascending: true })
    .limit(Math.min(limit, 50))

  if (search.trim()) {
    const term = `%${escapeIlike(search.trim())}%`
    query = query.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`)
  }

  const { data, error } = await query
  if (error) return { success: false as const, error: error.message }

  return {
    success: true as const,
    contacts: (data || []).map((row) => ({
      contactId: row.id as string,
      full_name: row.full_name as string | null,
      email: row.email as string | null,
      phone: row.phone as string | null,
    })),
  }
}

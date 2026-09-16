"use server"

import { getDepartmentHeadshipForCurrentUser } from "@/lib/departments/department-access"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

function escapeIlike(value: string) {
  return value.replace(/[%_\\,]/g, "\\$&")
}

/** Search individual contacts for HR role assignment (employee / volunteer). */
export async function searchContactsForHrPickerAction(search: string, limit = 30) {
  const canView =
    (await hasPermission(PERMISSIONS.CONTACTS_VIEW)) ||
    (await hasPermission(PERMISSIONS.STAFF_VIEW)) ||
    (await hasPermission(PERMISSIONS.MEMBERSHIP_VIEW)) ||
    (await hasPermission(PERMISSIONS.MEMBERSHIP_MANAGE)) ||
    (await hasPermission(PERMISSIONS.SETTINGS_USERS_VIEW)) ||
    (await hasPermission(PERMISSIONS.SETTINGS_USERS_MANAGE)) ||
    Boolean(await getDepartmentHeadshipForCurrentUser())

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

  const contacts = (data || []).map((row) => ({
    contactId: row.id as string,
    full_name: row.full_name as string | null,
    email: row.email as string | null,
    phone: row.phone as string | null,
  }))

  const term = search.trim()
  if (term) {
    const byId = new Set(contacts.map((contact) => contact.contactId))
    const admin = createServiceRoleClient()
    const { data: members } = await admin
      .from("organization_members")
      .select("assigned_contact_id, user_id")
      .eq("organization_id", organizationId)
      .not("assigned_contact_id", "is", null)
      .not("platform_support_access", "is", true)

    const assigned = (members || []).filter(
      (row) => row.assigned_contact_id && !byId.has(row.assigned_contact_id as string)
    )
    const userIds = assigned.map((row) => row.user_id as string)
    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, email")
        .in("id", userIds)

      const needle = term.toLowerCase()
      const matchingUserIds = new Set(
        (profiles || [])
          .filter((profile) =>
            String(profile.email || "")
              .toLowerCase()
              .includes(needle)
          )
          .map((profile) => profile.id as string)
      )
      const extraContactIds = assigned
        .filter((row) => matchingUserIds.has(row.user_id as string))
        .map((row) => row.assigned_contact_id as string)

      if (extraContactIds.length > 0) {
        const { data: extraContacts } = await admin
          .from("contacts")
          .select("id, full_name, email, phone")
          .eq("organization_id", organizationId)
          .eq("contact_type", "individual")
          .in("id", extraContactIds)

        for (const row of extraContacts || []) {
          const contactId = row.id as string
          if (byId.has(contactId)) continue
          byId.add(contactId)
          contacts.push({
            contactId,
            full_name: row.full_name as string | null,
            email: row.email as string | null,
            phone: row.phone as string | null,
          })
        }
      }
    }
  }

  return {
    success: true as const,
    contacts,
  }
}

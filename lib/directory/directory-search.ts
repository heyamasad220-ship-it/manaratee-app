"use server"

import { fetchDirectoryNavSummary } from "@/lib/directory/directory-nav-summary"
import { directoryFamilyPath } from "@/lib/directory/directory-paths"
import { directoryRolesFromContactRoles } from "@/lib/directory/directory-roles"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import {
  filterContactRoles,
  mapRoleValue,
  normalizeContactRecordType,
} from "@/lib/contacts/contact-constants"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"

export type DirectorySearchHitType = "person" | "organization" | "family"

export type DirectorySearchHit = {
  id: string
  type: DirectorySearchHitType
  title: string
  subtitle: string | null
  href: string
  roles: string[]
}

function escapeIlike(value: string) {
  return value.replace(/[%_\\,]/g, "\\$&")
}

export async function searchDirectoryAction(
  query: string,
  limitPerType = 6
): Promise<{ success: true; hits: DirectorySearchHit[] } | { success: false; error: string }> {
  const allowed = await hasPermission(PERMISSIONS.CONTACTS_VIEW)
  if (!allowed) {
    return { success: false, error: "Not authorized to search Directory." }
  }

  const term = query.trim()
  if (term.length < 2) {
    return { success: true, hits: [] }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: true, hits: [] }
  }

  const supabase = await createClient()
  const pattern = `%${escapeIlike(term)}%`
  const perType = Math.min(12, Math.max(3, limitPerType))

  const [peopleRes, orgRes, familyRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, full_name, email, phone, contact_type, contact_roles(role)")
      .eq("organization_id", organizationId)
      .eq("contact_type", "individual")
      .or(`full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
      .order("full_name", { ascending: true })
      .limit(perType),
    supabase
      .from("contacts")
      .select(
        "id, full_name, email, phone, primary_contact_name, contact_type, contact_roles(role)"
      )
      .eq("organization_id", organizationId)
      .eq("contact_type", "organization")
      .or(
        `full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},primary_contact_name.ilike.${pattern}`
      )
      .order("full_name", { ascending: true })
      .limit(perType),
    supabase
      .from("families")
      .select("id, name, primary_contact_id")
      .eq("organization_id", organizationId)
      .ilike("name", pattern)
      .eq("status", "active")
      .order("name", { ascending: true })
      .limit(perType),
  ])

  const hits: DirectorySearchHit[] = []

  for (const row of peopleRes.data || []) {
    const roleValues = filterContactRoles(
      ((row.contact_roles as { role?: string }[] | null) || []).map((item) => item.role || "")
    )
    hits.push({
      id: row.id as string,
      type: "person",
      title: (row.full_name as string) || "Unnamed person",
      subtitle: (row.email as string) || (row.phone as string) || null,
      href: contactProfileHref(row.id as string, { list: "people" }),
      roles: directoryRolesFromContactRoles(roleValues),
    })
  }

  for (const row of orgRes.data || []) {
    const roleValues = filterContactRoles(
      ((row.contact_roles as { role?: string }[] | null) || []).map((item) => item.role || "")
    )
    hits.push({
      id: row.id as string,
      type: "organization",
      title: (row.full_name as string) || "Unnamed organization",
      subtitle:
        (row.primary_contact_name as string) ||
        (row.email as string) ||
        (row.phone as string) ||
        null,
      href: contactProfileHref(row.id as string, { list: "organizations" }),
      roles: directoryRolesFromContactRoles(roleValues),
    })
  }

  for (const row of familyRes.data || []) {
    hits.push({
      id: row.id as string,
      type: "family",
      title: (row.name as string) || "Unnamed family",
      subtitle: null,
      href: directoryFamilyPath(row.id as string),
      roles: [],
    })
  }

  return { success: true, hits }
}

export async function fetchDirectoryOverviewAction() {
  const allowed = await hasPermission(PERMISSIONS.CONTACTS_VIEW)
  if (!allowed) {
    return { success: false as const, error: "Not authorized to view Directory." }
  }

  const summary = await fetchDirectoryNavSummary()
  return { success: true as const, summary }
}

export { mapRoleValue, normalizeContactRecordType }

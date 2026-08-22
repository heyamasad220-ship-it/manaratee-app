import { VENUE_RENTAL_CUSTOMER_EXCLUDED_STATUSES } from "@/lib/contacts/contact-affiliation-rules"
import {
  DIRECTORY_DYNAMIC_ROLE_DEFS,
  type DirectoryNavSummary,
  type DirectoryRoleCountMap,
} from "@/lib/directory/directory-roles"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"

const PARENT_FAMILY_ROLES = ["parent", "guardian"] as const

function excludedStatusFilter() {
  return `(${VENUE_RENTAL_CUSTOMER_EXCLUDED_STATUSES.join(",")})`
}

export async function fetchDirectoryNavSummary(
  organizationId?: string | null
): Promise<DirectoryNavSummary> {
  const empty: DirectoryNavSummary = {
    people: 0,
    families: 0,
    organizations: 0,
    groups: 0,
    roles: {},
  }

  const allowed = await hasPermission(PERMISSIONS.CONTACTS_VIEW)
  if (!allowed) return empty

  const supabase = await createClient()
  const orgId = organizationId ?? (await getSelectedOrganizationId())
  if (!orgId) return empty

  const roleDefs = DIRECTORY_DYNAMIC_ROLE_DEFS.filter((def) => def.source === "contact_roles")

  const queries = await Promise.all([
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("contact_type", "individual"),
    supabase
      .from("families")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "active"),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("contact_type", "organization"),
    ...roleDefs.map((def) =>
      supabase
        .from("contact_roles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("role", def.contactRole)
    ),
    supabase
      .from("family_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("role", [...PARENT_FAMILY_ROLES])
      .is("end_date", null)
      .not("contact_id", "is", null),
    supabase
      .from("venue_rentals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .not("billing_contact_id", "is", null)
      .not("status", "in", excludedStatusFilter()),
  ])

  const [peopleRes, familiesRes, organizationsRes, ...rest] = queries
  const roles: DirectoryRoleCountMap = {}

  roleDefs.forEach((def, index) => {
    const count = rest[index]?.count ?? 0
    if (count > 0) roles[def.key] = count
  })

  const parentCount = rest[roleDefs.length]?.count ?? 0
  if (parentCount > 0) roles.parents = parentCount

  const rentalCount = rest[roleDefs.length + 1]?.count ?? 0
  if (rentalCount > 0) roles["rental-customers"] = rentalCount

  return {
    people: peopleRes.count ?? 0,
    families: familiesRes.error ? 0 : (familiesRes.count ?? 0),
    organizations: organizationsRes.count ?? 0,
    groups: 0,
    roles,
  }
}

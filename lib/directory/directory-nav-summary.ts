import { VENUE_RENTAL_CUSTOMER_EXCLUDED_STATUSES } from "@/lib/contacts/contact-affiliation-rules"
import {
  DIRECTORY_DYNAMIC_ROLE_DEFS,
  type DirectoryNavSummary,
  type DirectoryRoleCountMap,
} from "@/lib/directory/directory-roles"
import { isOrganizationModuleEnabled, loadOrganizationEnabledModuleSlugs } from "@/lib/modules/dashboard-module-access-server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

const PARENT_FAMILY_ROLES = ["parent", "guardian"] as const
const DIRECTORY_NAV_CACHE_TTL_MS = 60_000

const directoryNavCache = new Map<
  string,
  { expiresAt: number; value: DirectoryNavSummary }
>()

function excludedStatusFilter() {
  return `(${VENUE_RENTAL_CUSTOMER_EXCLUDED_STATUSES.join(",")})`
}

function emptyDirectoryNavSummary(): DirectoryNavSummary {
  return {
    people: 0,
    families: 0,
    organizations: 0,
    groups: 0,
    roles: {},
    facilitiesEnabled: false,
  }
}

export function clearDirectoryNavSummaryCache(organizationId?: string) {
  if (organizationId) {
    directoryNavCache.delete(organizationId)
    return
  }
  directoryNavCache.clear()
}

export async function isDirectoryFacilitiesEnabled(
  organizationId?: string | null
) {
  const orgId = organizationId ?? (await getSelectedOrganizationId())
  if (!orgId) return false
  const slugs = await loadOrganizationEnabledModuleSlugs(orgId)
  return isOrganizationModuleEnabled(slugs, "spaces")
}

async function loadDirectoryNavSummary(orgId: string): Promise<DirectoryNavSummary> {
  const admin = createServiceRoleClient()
  const roleDefs = DIRECTORY_DYNAMIC_ROLE_DEFS.filter((def) => def.source === "contact_roles")

  const [
    peopleRes,
    familiesRes,
    organizationsRes,
    parentRes,
    rentalRes,
    enabledSlugs,
    ...roleCountResults
  ] = await Promise.all([
    admin
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("contact_type", "individual"),
    admin
      .from("families")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "active"),
    admin
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("contact_type", "organization"),
    admin
      .from("family_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("role", [...PARENT_FAMILY_ROLES])
      .is("end_date", null)
      .not("contact_id", "is", null),
    admin
      .from("venue_rentals")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .not("billing_contact_id", "is", null)
      .not("status", "in", excludedStatusFilter()),
    loadOrganizationEnabledModuleSlugs(orgId),
    ...roleDefs.map((def) =>
      admin
        .from("contact_roles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("role", def.contactRole)
    ),
  ])

  const roles: DirectoryRoleCountMap = {}
  roleDefs.forEach((def, index) => {
    const count = roleCountResults[index]?.count ?? 0
    if (count > 0) roles[def.key] = count
  })

  const parentCount = parentRes.count ?? 0
  if (parentCount > 0) roles.parents = parentCount

  const rentalCount = rentalRes.count ?? 0
  if (rentalCount > 0) roles["rental-customers"] = rentalCount

  return {
    people: peopleRes.count ?? 0,
    families: familiesRes.error ? 0 : (familiesRes.count ?? 0),
    organizations: organizationsRes.count ?? 0,
    groups: 0,
    roles,
    facilitiesEnabled: isOrganizationModuleEnabled(enabledSlugs, "spaces"),
  }
}

export async function fetchCachedDirectoryNavSummary(
  organizationId: string
): Promise<DirectoryNavSummary> {
  const cached = directoryNavCache.get(organizationId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const value = await loadDirectoryNavSummary(organizationId)
  directoryNavCache.set(organizationId, {
    expiresAt: Date.now() + DIRECTORY_NAV_CACHE_TTL_MS,
    value,
  })
  return value
}

export async function fetchDirectoryNavSummary(
  organizationId?: string | null
): Promise<DirectoryNavSummary> {
  const allowed = await hasPermission(PERMISSIONS.CONTACTS_VIEW)
  if (!allowed) return emptyDirectoryNavSummary()

  const orgId = organizationId ?? (await getSelectedOrganizationId())
  if (!orgId) return emptyDirectoryNavSummary()

  return fetchCachedDirectoryNavSummary(orgId)
}

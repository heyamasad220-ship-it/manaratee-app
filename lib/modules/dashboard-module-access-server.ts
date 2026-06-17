import { redirect } from "next/navigation"

import { normalizeModuleSlug } from "@/lib/modules/module-catalog"
import { loadOrganizationSidebarModules } from "@/lib/organizations/load-organization-sidebar-modules"
import { getCurrentUserPermissionContext } from "@/lib/permissions/permissions"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function loadOrganizationEnabledModuleSlugs(
  organizationId: string
): Promise<Set<string>> {
  const client = createServiceRoleClient()
  const rows = await loadOrganizationSidebarModules(client, organizationId)
  return new Set(rows.map((row) => normalizeModuleSlug(row.slug)))
}

export function isOrganizationModuleEnabled(
  enabledSlugs: Set<string>,
  moduleSlug: string
): boolean {
  return enabledSlugs.has(normalizeModuleSlug(moduleSlug))
}

export async function requireOrganizationModule(moduleSlug: string) {
  const { organizationId } = await getCurrentUserPermissionContext()
  const enabledSlugs = await loadOrganizationEnabledModuleSlugs(organizationId)

  if (!isOrganizationModuleEnabled(enabledSlugs, moduleSlug)) {
    redirect("/dashboard")
  }

  return { organizationId, enabledSlugs }
}

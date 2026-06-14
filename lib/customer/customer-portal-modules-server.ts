import type { SupabaseClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"

import { requireCustomerPortalPageContext } from "@/lib/auth/require-customer-portal-page"
import {
  isCustomerPortalModuleEnabled,
  resolveRequiredModuleForCustomerPath,
} from "@/lib/customer/customer-portal-modules"
import { normalizeModuleSlug } from "@/lib/modules/module-catalog"
import { loadOrganizationSidebarModules } from "@/lib/organizations/load-organization-sidebar-modules"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function loadCustomerPortalEnabledModuleSlugs(
  organizationId: string,
  supabase?: SupabaseClient
): Promise<Set<string>> {
  const client = supabase ?? createServiceRoleClient()
  const rows = await loadOrganizationSidebarModules(client, organizationId)
  return new Set(rows.map((row) => normalizeModuleSlug(row.slug)))
}

export async function requireCustomerPortalModule(moduleSlug: string) {
  const context = await requireCustomerPortalPageContext()
  const enabledSlugs = await loadCustomerPortalEnabledModuleSlugs(
    context.organizationId
  )

  if (!isCustomerPortalModuleEnabled(enabledSlugs, moduleSlug)) {
    redirect("/customer/dashboard")
  }

  return context
}

export async function guardCustomerPortalPath(pathname: string) {
  const requiredModule = resolveRequiredModuleForCustomerPath(pathname)
  if (!requiredModule) return null
  return requireCustomerPortalModule(requiredModule)
}

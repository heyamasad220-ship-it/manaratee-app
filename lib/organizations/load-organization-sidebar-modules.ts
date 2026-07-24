import type { SupabaseClient } from "@supabase/supabase-js"

import {
  isCoreModuleSlug,
  isProductModuleSlug,
  normalizeModuleSlug,
} from "@/lib/modules/module-catalog"

export type SidebarModuleRow = {
  name: string
  slug: string
  route: string | null
  icon_name: string | null
  group_name: string | null
  sort_order: number | null
}

/** Fallback metadata when DB rows are incomplete or the modules embed fails. */
const SIDEBAR_MODULE_DEFAULTS: Record<
  string,
  Omit<SidebarModuleRow, "slug">
> = {
  contacts: {
    name: "Contacts",
    route: "/contacts/people",
    icon_name: "Users",
    group_name: "People",
    sort_order: 10,
  },
  workforce: {
    name: "HR",
    route: "/workforce",
    icon_name: "Users",
    group_name: "People",
    sort_order: 20,
  },
  membership: {
    name: "Membership",
    route: "/membership",
    icon_name: "UserCheck",
    group_name: "People",
    sort_order: 25,
  },
  donations: {
    name: "Fund Development",
    route: "/donations",
    icon_name: "Heart",
    group_name: "Financial",
    sort_order: 30,
  },
  finance: {
    name: "Finance",
    route: "/finance/payroll",
    icon_name: "Wallet",
    group_name: "Financial",
    sort_order: 35,
  },
  programs: {
    name: "Programs",
    route: "/programs/catalog",
    icon_name: "GraduationCap",
    group_name: "Operations",
    sort_order: 40,
  },
  "event-management": {
    name: "Event Management",
    route: "/event-management/overview",
    icon_name: "LayoutGrid",
    group_name: "Operations",
    sort_order: 50,
  },
  bookings: {
    name: "Venue Rentals",
    route: "/bookings/overview",
    icon_name: "Calendar",
    group_name: "Operations",
    sort_order: 60,
  },
  "vendor-hub": {
    name: "Vendor Hub",
    route: "/vendor-hub",
    icon_name: "Store",
    group_name: "Operations",
    sort_order: 70,
  },
  spaces: {
    name: "Facility Manager",
    route: "/facilities/reservation-center",
    icon_name: "Building2",
    group_name: "Facilities",
    sort_order: 80,
  },
}

function unwrapModule(modules: unknown) {
  if (!modules) return null
  if (Array.isArray(modules)) return modules[0] ?? null
  return modules as Record<string, unknown>
}

function toSidebarRow(
  slug: string,
  mod: Record<string, unknown> | null
): SidebarModuleRow | null {
  const normalized = normalizeModuleSlug(slug)
  const defaults = SIDEBAR_MODULE_DEFAULTS[normalized]

  // Retire inactive capability/legacy modules, but never hide an org-enabled product module.
  if (
    mod?.is_active === false &&
    mod?.is_core !== true &&
    !isProductModuleSlug(normalized) &&
    !isCoreModuleSlug(normalized)
  ) {
    return null
  }

  const route =
    (typeof mod?.route === "string" && mod.route.trim()) ||
    defaults?.route ||
    null

  if (!route) {
    return null
  }

  return {
    name:
      (typeof mod?.name === "string" && mod.name.trim()) ||
      defaults?.name ||
      normalized,
    slug: normalized,
    route,
    icon_name:
      (typeof mod?.icon_name === "string" && mod.icon_name) ||
      defaults?.icon_name ||
      null,
    group_name:
      (typeof mod?.group_name === "string" && mod.group_name) ||
      defaults?.group_name ||
      null,
    sort_order:
      (typeof mod?.sort_order === "number" ? mod.sort_order : null) ??
      defaults?.sort_order ??
      null,
  }
}

export async function loadOrganizationSidebarModules(
  supabase: SupabaseClient,
  organizationId: string
): Promise<SidebarModuleRow[]> {
  const { data, error } = await supabase
    .from("organization_modules")
    .select(
      `
      enabled,
      module_id,
      modules (
        name,
        slug,
        route,
        icon_name,
        group_name,
        sort_order,
        is_core,
        is_active
      )
    `
    )
    .eq("organization_id", organizationId)
    .eq("enabled", true)

  if (error) {
    console.error("loadOrganizationSidebarModules error:", error)
    return []
  }

  const rowsBySlug = new Map<string, SidebarModuleRow>()
  const missingModuleIds: string[] = []

  for (const item of data ?? []) {
    const mod = unwrapModule(item.modules)
    const moduleId =
      typeof item.module_id === "string" ? item.module_id : null

    if (!mod) {
      if (moduleId) missingModuleIds.push(moduleId)
      continue
    }

    const slug = typeof mod.slug === "string" ? mod.slug : null
    if (!slug) {
      if (moduleId) missingModuleIds.push(moduleId)
      continue
    }

    const row = toSidebarRow(slug, mod)
    if (!row) continue
    rowsBySlug.set(row.slug, row)
  }

  if (missingModuleIds.length > 0) {
    const { data: recovered, error: recoveredError } = await supabase
      .from("modules")
      .select(
        "id, name, slug, route, icon_name, group_name, sort_order, is_core, is_active"
      )
      .in("id", missingModuleIds)

    if (recoveredError) {
      console.error(
        "loadOrganizationSidebarModules recovery error:",
        recoveredError
      )
    } else {
      for (const mod of recovered ?? []) {
        if (!mod?.slug) continue
        const row = toSidebarRow(String(mod.slug), mod as Record<string, unknown>)
        if (!row) continue
        rowsBySlug.set(row.slug, row)
      }
    }
  }

  return Array.from(rowsBySlug.values())
}

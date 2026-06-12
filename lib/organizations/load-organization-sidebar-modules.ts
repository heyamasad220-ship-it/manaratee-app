import type { SupabaseClient } from "@supabase/supabase-js"

export type SidebarModuleRow = {
  name: string
  slug: string
  route: string | null
  icon_name: string | null
  group_name: string | null
  sort_order: number | null
}

function unwrapModule(modules: unknown) {
  if (!modules) return null
  if (Array.isArray(modules)) return modules[0] ?? null
  return modules as Record<string, unknown>
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

  const rows: SidebarModuleRow[] = []

  for (const item of data ?? []) {
    const mod = unwrapModule(item.modules)
    if (!mod) continue

    const slug = mod.slug as string | undefined
    if (!slug) continue

    if (mod.is_active === false && mod.is_core !== true) {
      continue
    }

    rows.push({
      name: (mod.name as string) ?? slug,
      slug,
      route: (mod.route as string | null) ?? null,
      icon_name: (mod.icon_name as string | null) ?? null,
      group_name: (mod.group_name as string | null) ?? null,
      sort_order: (mod.sort_order as number | null) ?? null,
    })
  }

  return rows
}

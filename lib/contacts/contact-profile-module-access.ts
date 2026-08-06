import { normalizeModuleSlug } from "@/lib/modules/module-catalog"

export type ContactProfileModuleFlags = {
  donations: boolean
  bookings: boolean
  workforce: boolean
  vendorHub: boolean
  programs: boolean
  membership: boolean
  applications: boolean
}

export function buildEnabledModuleSlugSet(slugs: Iterable<string>): Set<string> {
  return new Set(Array.from(slugs, (slug) => normalizeModuleSlug(slug)))
}

export function isModuleEnabled(
  enabledSlugs: Set<string>,
  moduleSlug: string
): boolean {
  return enabledSlugs.has(normalizeModuleSlug(moduleSlug))
}

export function getContactProfileModuleFlags(
  enabledSlugs: Iterable<string>
): ContactProfileModuleFlags {
  const slugs = buildEnabledModuleSlugSet(enabledSlugs)

  return {
    donations: slugs.has("donations"),
    bookings: slugs.has("bookings"),
    workforce: slugs.has("workforce"),
    vendorHub: slugs.has("vendor-hub"),
    programs: slugs.has("programs"),
    membership: slugs.has("membership"),
    applications: slugs.has("applications"),
  }
}

/** Overview right-rail Financial Summary + Financial tab visibility. */
export function showContactFinancialSurfaces(modules: ContactProfileModuleFlags) {
  return (
    modules.donations ||
    modules.bookings ||
    modules.programs ||
    modules.membership ||
    modules.vendorHub
  )
}

/** Core CRM timeline labels that stay visible regardless of subscribed modules. */
const CORE_TIMELINE_MODULES = new Set(["Contacts", "Roles", "Notes"])

/**
 * Map display timeline `module` labels to tenant module flags.
 * Unknown / unsubscribed modules are hidden.
 */
export function isContactTimelineModuleEnabled(
  moduleLabel: string,
  modules: ContactProfileModuleFlags
): boolean {
  if (CORE_TIMELINE_MODULES.has(moduleLabel)) return true

  switch (moduleLabel) {
    case "Donations":
      return modules.donations
    case "Programs":
      return modules.programs
    case "Rentals":
    case "Spaces":
      return modules.bookings
    case "Vendor Hub":
      return modules.vendorHub
    case "Teams":
      return modules.membership
    default:
      return false
  }
}

export function filterContactTimelineByModules<T extends { module: string }>(
  items: T[],
  modules: ContactProfileModuleFlags
): T[] {
  return items.filter((item) => isContactTimelineModuleEnabled(item.module, modules))
}

import { normalizeModuleSlug } from "@/lib/modules/module-catalog"

/** Product module slug required for each customer portal area. */
export const CUSTOMER_PORTAL_MODULE_BY_PATH_PREFIX: Array<{
  prefix: string
  moduleSlug: string
}> = [
  { prefix: "/customer/rentals", moduleSlug: "bookings" },
  { prefix: "/customer/bookings", moduleSlug: "bookings" },
  { prefix: "/customer/book-venue", moduleSlug: "bookings" },
  { prefix: "/customer/venue-availability", moduleSlug: "bookings" },
  { prefix: "/customer/calendar", moduleSlug: "bookings" },
  { prefix: "/customer/donation", moduleSlug: "donations" },
  { prefix: "/customer/programs", moduleSlug: "programs" },
  { prefix: "/customer/bazaars", moduleSlug: "vendor-hub" },
  { prefix: "/customer/opportunities", moduleSlug: "membership" },
]

export type CustomerPortalNavItemConfig = {
  label: string
  href: string
  moduleSlug: string | null
}

/** Customer sidebar items and the org module each requires (null = always shown). */
export const CUSTOMER_PORTAL_NAV_ITEMS: CustomerPortalNavItemConfig[] = [
  { label: "Dashboard", href: "/customer/dashboard", moduleSlug: null },
  { label: "Venue Rentals", href: "/customer/rentals", moduleSlug: "bookings" },
  { label: "Donations", href: "/customer/donation", moduleSlug: "donations" },
  { label: "Programs", href: "/customer/programs", moduleSlug: "programs" },
  { label: "My Bazaars", href: "/customer/bazaars", moduleSlug: "vendor-hub" },
  { label: "Opportunities", href: "/customer/opportunities", moduleSlug: "membership" },
  { label: "Profile", href: "/customer/profile", moduleSlug: null },
]

export function isCustomerPortalModuleEnabled(
  enabledSlugs: Set<string>,
  moduleSlug: string | null | undefined
): boolean {
  if (!moduleSlug) return true
  return enabledSlugs.has(normalizeModuleSlug(moduleSlug))
}

export function filterCustomerPortalNavItems(
  items: CustomerPortalNavItemConfig[],
  enabledSlugs: Set<string>
): CustomerPortalNavItemConfig[] {
  return items.filter((item) => isCustomerPortalModuleEnabled(enabledSlugs, item.moduleSlug))
}

export function resolveRequiredModuleForCustomerPath(pathname: string): string | null {
  const normalized = pathname.split("?")[0]
  for (const entry of CUSTOMER_PORTAL_MODULE_BY_PATH_PREFIX) {
    if (
      normalized === entry.prefix ||
      normalized.startsWith(`${entry.prefix}/`)
    ) {
      return entry.moduleSlug
    }
  }
  return null
}

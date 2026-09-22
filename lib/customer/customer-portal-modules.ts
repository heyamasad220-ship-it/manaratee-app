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
  { prefix: "/customer/tickets", moduleSlug: "event-management" },
]

export type CustomerPortalNavItemConfig = {
  label: string
  href: string
  moduleSlug: string | null
}

/** Customer sidebar items and the org module each requires (null = always shown). */
export const CUSTOMER_PORTAL_NAV_ITEMS: CustomerPortalNavItemConfig[] = [
  { label: "Dashboard", href: "/customer/dashboard", moduleSlug: null },
  { label: "My Tickets", href: "/customer/tickets", moduleSlug: "event-management" },
  { label: "Venue Rentals", href: "/customer/rentals", moduleSlug: "bookings" },
  { label: "Donations", href: "/customer/donation", moduleSlug: "donations" },
  { label: "My Transactions", href: "/customer/transactions", moduleSlug: null },
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

/** Show My Tickets when Event Management or Ticketing is enabled. */
export function showCustomerTicketsNav(enabledSlugs: Set<string>): boolean {
  return (
    isCustomerPortalModuleEnabled(enabledSlugs, "event-management") ||
    isCustomerPortalModuleEnabled(enabledSlugs, "ticketing")
  )
}

/** Show My Transactions when any financial module is enabled for the org. */
export function showCustomerMyTransactionsNav(enabledSlugs: Set<string>): boolean {
  return (
    isCustomerPortalModuleEnabled(enabledSlugs, "donations") ||
    isCustomerPortalModuleEnabled(enabledSlugs, "programs") ||
    isCustomerPortalModuleEnabled(enabledSlugs, "bookings") ||
    isCustomerPortalModuleEnabled(enabledSlugs, "membership")
  )
}

/** Staff review volunteer/childcare applications in Administration (Programs or Event Management). */
export const CUSTOMER_WORKFORCE_APPLICATION_MODULES = [
  "programs",
  "event-management",
] as const

/** Profile → Applications cards and the matching apply routes. */
export const CUSTOMER_APPLICATION_TYPE_MODULES: Record<string, readonly string[]> = {
  vendor: ["vendor-hub"],
  volunteer: CUSTOMER_WORKFORCE_APPLICATION_MODULES,
  childcare_provider: CUSTOMER_WORKFORCE_APPLICATION_MODULES,
}

export function toCustomerEnabledSlugSet(
  enabledSlugs: Iterable<string> | Set<string>
): Set<string> {
  return enabledSlugs instanceof Set ? enabledSlugs : new Set(enabledSlugs)
}

export function isCustomerApplicationTypeEnabled(
  enabledSlugs: Iterable<string> | Set<string>,
  applicationTypeId: string
): boolean {
  const modules = CUSTOMER_APPLICATION_TYPE_MODULES[applicationTypeId]
  if (!modules) return false
  const enabled = toCustomerEnabledSlugSet(enabledSlugs)
  return modules.some((slug) => isCustomerPortalModuleEnabled(enabled, slug))
}

/** Show Profile → Applications when any role application type is subscribed. */
export function showCustomerApplicationsNav(
  enabledSlugs: Iterable<string> | Set<string>
): boolean {
  return Object.keys(CUSTOMER_APPLICATION_TYPE_MODULES).some((applicationTypeId) =>
    isCustomerApplicationTypeEnabled(enabledSlugs, applicationTypeId)
  )
}

export function filterCustomerPortalNavItems(
  items: CustomerPortalNavItemConfig[],
  enabledSlugs: Set<string>
): CustomerPortalNavItemConfig[] {
  return items.filter((item) => {
    if (item.href === "/customer/transactions") {
      return showCustomerMyTransactionsNav(enabledSlugs)
    }
    if (item.href === "/customer/tickets") {
      return showCustomerTicketsNav(enabledSlugs)
    }
    return isCustomerPortalModuleEnabled(enabledSlugs, item.moduleSlug)
  })
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

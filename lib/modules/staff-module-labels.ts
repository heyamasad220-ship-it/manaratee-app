import { FUND_DEVELOPMENT_MODULE_LABEL } from "@/lib/donations/fund-development-module-label"
import {
  EDITABLE_CAPABILITY_SLUGS,
  getProductImpliedCapabilitySlugs,
  isProductModuleSlug,
  normalizeModuleSlug,
} from "@/lib/modules/module-catalog"

const STAFF_MODULE_LABELS: Record<string, string> = {
  contacts: "Directory",
  donations: FUND_DEVELOPMENT_MODULE_LABEL,
  workforce: "Administration",
  hr: "Administration",
  membership: "Membership",
  programs: "Programs",
  "event-management": "Event Management",
  bookings: "Venue Rentals",
  spaces: "Facilities",
  finance: "Finance",
  "vendor-hub": "Vendor Hub",
  "community-calendar": "Community Calendar",
  ticketing: "Ticketing",
  "child-care": "Childcare",
  "sign-ups": "Volunteer Sign-Ups",
  reports: "Reports",
  applications: "Applications",
}

/** Product modules shown as the org's subscription on Dashboard. Facilities is implied, not listed. */
export function isDashboardSubscribedModule(slug: string) {
  const normalized = normalizeModuleSlug(slug)
  return isProductModuleSlug(normalized)
}

export function staffModuleDisplayName(slug: string, fallback?: string | null) {
  const normalized = normalizeModuleSlug(slug)
  const label = STAFF_MODULE_LABELS[normalized]
  if (label) return label
  const trimmed = fallback?.trim()
  if (trimmed) return trimmed
  return normalized
}

/** Caption for Super Admin module rows, e.g. "Includes Facilities and Finance". */
export function productModuleIncludesCaption(
  slug: string,
  includedCapabilitySlugs?: readonly string[]
): string | null {
  const capabilitySlugs =
    includedCapabilitySlugs ?? getProductImpliedCapabilitySlugs(slug)
  const names = capabilitySlugs.map((capabilitySlug) =>
    staffModuleDisplayName(capabilitySlug)
  )
  if (names.length === 0) return null
  if (names.length === 1) return `Includes ${names[0]}`
  if (names.length === 2) return `Includes ${names[0]} and ${names[1]}`
  return `Includes ${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`
}

export function catalogCapabilityCheckboxItems() {
  return EDITABLE_CAPABILITY_SLUGS.map((slug) => ({
    slug,
    name: staffModuleDisplayName(slug),
  }))
}

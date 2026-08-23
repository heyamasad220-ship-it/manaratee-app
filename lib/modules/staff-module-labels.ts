import { FUND_DEVELOPMENT_MODULE_LABEL } from "@/lib/donations/fund-development-module-label"
import {
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

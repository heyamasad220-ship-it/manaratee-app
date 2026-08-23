import { FUND_DEVELOPMENT_MODULE_LABEL } from "@/lib/donations/fund-development-module-label"
import { WORKFORCE_MODULE_LABEL } from "@/lib/hr/hr-module-label"
import {
  isProductModuleSlug,
  normalizeModuleSlug,
} from "@/lib/modules/module-catalog"

const STAFF_MODULE_LABELS: Record<string, string> = {
  contacts: "Directory",
  donations: FUND_DEVELOPMENT_MODULE_LABEL,
  workforce: WORKFORCE_MODULE_LABEL,
  hr: WORKFORCE_MODULE_LABEL,
  membership: "Membership",
  programs: "Programs",
  "event-management": "Event Management",
  bookings: "Venue Rentals",
  spaces: "Facilities",
  finance: "Finance",
  "vendor-hub": "Vendor Hub",
}

/** Product (and Facilities) modules shown as the org's subscription on Dashboard. */
export function isDashboardSubscribedModule(slug: string) {
  const normalized = normalizeModuleSlug(slug)
  return isProductModuleSlug(normalized) || normalized === "spaces"
}

export function staffModuleDisplayName(slug: string, fallback?: string | null) {
  const normalized = normalizeModuleSlug(slug)
  const label = STAFF_MODULE_LABELS[normalized]
  if (label) return label
  const trimmed = fallback?.trim()
  if (trimmed) return trimmed
  return normalized
}

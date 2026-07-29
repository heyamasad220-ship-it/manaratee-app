/**
 * Product module catalog for multi-tenant subscriptions.
 * Source of truth for persona bundles, billable modules, and implied capabilities.
 */

export type SubscriptionBundle = {
  slug: string
  name: string
  description: string
  moduleSlugs: string[]
}

/** Always included for every tenant — not sold separately. */
export const CORE_MODULE_SLUGS = ["dashboard", "contacts", "settings"] as const

/** Billable product modules shown in the platform admin catalog. */
export const PRODUCT_MODULE_SLUGS = [
  "event-management",
  "programs",
  "vendor-hub",
  "bookings",
  "donations",
  "finance",
  "workforce",
  "membership",
] as const

/** Enabled automatically when a parent product module is on — not sold separately. */
export const CAPABILITY_MODULE_SLUGS = [
  "ticketing",
  "spaces",
  "sign-ups",
  "child-care",
  "bazaar",
  "hr",
  "reports",
  "applications",
] as const

/** When a product module is enabled, these capability slugs are also enabled. */
export const IMPLIED_MODULE_SLUGS: Record<string, readonly string[]> = {
  /** Basic facility calendar, spaces, and conflict checking for campus events. */
  "event-management": ["ticketing", "spaces"],
  /** Basic facility calendar/availability for program sessions that use spaces. */
  programs: ["spaces"],
  bookings: ["spaces"],
}

/** Legacy slugs mapped to current product modules during migration / reads. */
export const LEGACY_MODULE_ALIASES: Record<string, string> = {
  bazaar: "vendor-hub",
  hr: "workforce",
}

export const SUBSCRIPTION_BUNDLES: SubscriptionBundle[] = [
  {
    slug: "community-center",
    name: "Community Center",
    description:
      "Full operations suite — events, programs, vendors, venue rentals, giving, workforce, and membership.",
    moduleSlugs: [
      "event-management",
      "programs",
      "vendor-hub",
      "bookings",
      "donations",
      "finance",
      "workforce",
      "membership",
    ],
  },
  {
    slug: "school",
    name: "School / Education",
    description: "Campus programs and department events.",
    moduleSlugs: ["programs", "event-management"],
  },
  {
    slug: "bazaar-organizer",
    name: "Bazaar / Marketplace",
    description: "Vendor marketplace with supporting event operations.",
    moduleSlugs: ["vendor-hub", "event-management"],
  },
  {
    slug: "venue",
    name: "Venue / Rentals",
    description: "Reservation center and rental workflows (includes Facilities).",
    moduleSlugs: ["bookings"],
  },
  {
    slug: "nonprofit",
    name: "Nonprofit",
    description: "Donor engagement, pledges, and fundraising.",
    moduleSlugs: ["donations"],
  },
  {
    slug: "faith-membership",
    name: "Faith + Membership",
    description: "Member directory, teams, events, and giving.",
    moduleSlugs: ["membership", "donations", "event-management"],
  },
]

export function normalizeModuleSlug(slug: string): string {
  return LEGACY_MODULE_ALIASES[slug] ?? slug
}

export function isCoreModuleSlug(slug: string): boolean {
  return (CORE_MODULE_SLUGS as readonly string[]).includes(slug)
}

export function isProductModuleSlug(slug: string): boolean {
  return (PRODUCT_MODULE_SLUGS as readonly string[]).includes(
    normalizeModuleSlug(slug)
  )
}

export function isCapabilityModuleSlug(slug: string): boolean {
  return (CAPABILITY_MODULE_SLUGS as readonly string[]).includes(slug)
}

export function isCatalogModuleSlug(slug: string): boolean {
  return isProductModuleSlug(slug)
}

export function getSubscriptionBundle(slug: string): SubscriptionBundle | undefined {
  return SUBSCRIPTION_BUNDLES.find((bundle) => bundle.slug === slug)
}

/** Expand a set of enabled product slugs to include implied capabilities. */
export function expandEnabledModuleSlugs(productSlugs: Iterable<string>): Set<string> {
  const enabled = new Set<string>()

  for (const rawSlug of productSlugs) {
    const slug = normalizeModuleSlug(rawSlug)
    enabled.add(slug)

    for (const implied of IMPLIED_MODULE_SLUGS[slug] ?? []) {
      enabled.add(implied)
    }
  }

  for (const core of CORE_MODULE_SLUGS) {
    enabled.add(core)
  }

  return enabled
}

/** Slugs that should flip when toggling a product module on/off. */
export function getModuleToggleTargets(
  moduleSlug: string,
  enabled: boolean
): string[] {
  const slug = normalizeModuleSlug(moduleSlug)
  const targets = new Set<string>([slug])

  if (enabled) {
    for (const implied of IMPLIED_MODULE_SLUGS[slug] ?? []) {
      targets.add(implied)
    }
  } else {
    for (const implied of IMPLIED_MODULE_SLUGS[slug] ?? []) {
      targets.add(implied)
    }
  }

  return Array.from(targets)
}

export function getCapabilityParentSlug(slug: string): string | undefined {
  for (const [parent, children] of Object.entries(IMPLIED_MODULE_SLUGS)) {
    if (children.includes(slug)) {
      return parent
    }
  }
  return undefined
}

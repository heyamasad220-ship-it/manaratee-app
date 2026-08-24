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
export const CORE_MODULE_SLUGS = [
  "dashboard",
  "contacts",
  "settings",
  "workforce",
] as const

/** Billable product modules shown in the platform admin catalog. */
export const PRODUCT_MODULE_SLUGS = [
  "event-management",
  "programs",
  "vendor-hub",
  "bookings",
  "donations",
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
  "finance",
  "community-calendar",
] as const

/** Capability slugs that stay in the database but are not shown on billing/subscription UI. */
export const HIDDEN_SUBSCRIPTION_CAPABILITY_SLUGS = [
  "finance",
  "hr",
  "bazaar",
  "spaces",
  "community-calendar",
  "sign-ups",
  "child-care",
] as const

/** Capabilities Super Admin can attach to a product module. Omits legacy hr/bazaar. */
export const EDITABLE_CAPABILITY_SLUGS = [
  "ticketing",
  "spaces",
  "community-calendar",
  "sign-ups",
  "child-care",
  "finance",
  "reports",
  "applications",
] as const

/** When a product module is enabled, these capability slugs are also enabled. */
export const IMPLIED_MODULE_SLUGS: Record<string, readonly string[]> = {
  /** Ticketing, facilities, community calendar, volunteer sign-ups, and childcare. */
  "event-management": [
    "ticketing",
    "spaces",
    "community-calendar",
    "sign-ups",
    "child-care",
  ],
  /** Facilities, program billing, volunteer sign-ups, and childcare. */
  programs: ["spaces", "finance", "sign-ups", "child-care"],
  bookings: ["spaces"],
  /** Bazaar/vendor events that reserve campus spaces, plus the public community calendar. */
  "vendor-hub": ["spaces", "community-calendar"],
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
      "Full operations suite — events, programs, vendors, venue rentals, giving, and membership.",
    moduleSlugs: [
      "event-management",
      "programs",
      "vendor-hub",
      "bookings",
      "donations",
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
  return (CORE_MODULE_SLUGS as readonly string[]).includes(normalizeModuleSlug(slug))
}

export function isProductModuleSlug(slug: string): boolean {
  return (PRODUCT_MODULE_SLUGS as readonly string[]).includes(
    normalizeModuleSlug(slug)
  )
}

export function isCapabilityModuleSlug(slug: string): boolean {
  return (CAPABILITY_MODULE_SLUGS as readonly string[]).includes(slug)
}

export function isHiddenSubscriptionCapabilitySlug(slug: string): boolean {
  return (HIDDEN_SUBSCRIPTION_CAPABILITY_SLUGS as readonly string[]).includes(
    normalizeModuleSlug(slug)
  )
}

export function isCatalogModuleSlug(slug: string): boolean {
  return isProductModuleSlug(slug)
}

export function slugifyProductModuleSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

export function isValidProductModuleSlug(slug: string): boolean {
  return /^[a-z][a-z0-9-]{1,47}$/.test(slug)
}

export function sanitizeIncludedCapabilitySlugs(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  const selected = new Set<string>()
  for (const value of values) {
    const slug = String(value || "").trim()
    if ((EDITABLE_CAPABILITY_SLUGS as readonly string[]).includes(slug)) {
      selected.add(slug)
    }
  }
  return EDITABLE_CAPABILITY_SLUGS.filter((slug) => selected.has(slug))
}

export function filterProductModuleSlugs(slugs: Iterable<string>): string[] {
  const selected = new Set<string>()
  for (const rawSlug of slugs) {
    const slug = normalizeModuleSlug(rawSlug)
    if (!slug || isCoreModuleSlug(slug) || isCapabilityModuleSlug(slug)) continue
    selected.add(slug)
  }
  const ordered = PRODUCT_MODULE_SLUGS.filter((slug) => selected.has(slug))
  for (const slug of selected) {
    if (!ordered.includes(slug)) ordered.push(slug)
  }
  return ordered
}

export function getProductImpliedCapabilitySlugs(
  productSlug: string,
  impliedByProduct?: Record<string, readonly string[]>
): readonly string[] {
  const slug = normalizeModuleSlug(productSlug)
  if (impliedByProduct && Object.prototype.hasOwnProperty.call(impliedByProduct, slug)) {
    return impliedByProduct[slug] ?? []
  }
  return IMPLIED_MODULE_SLUGS[slug] ?? []
}

/** Product slugs plus implied capabilities. Used when saving organization_modules. */
export function expandPlanModuleSlugs(
  productSlugs: Iterable<string>,
  impliedByProduct?: Record<string, readonly string[]>
): string[] {
  const products = filterProductModuleSlugs(productSlugs)
  const enabled = new Set<string>(products)
  for (const slug of products) {
    for (const implied of getProductImpliedCapabilitySlugs(slug, impliedByProduct)) {
      enabled.add(implied)
    }
  }
  return Array.from(enabled)
}

export function getSubscriptionBundle(slug: string): SubscriptionBundle | undefined {
  return SUBSCRIPTION_BUNDLES.find((bundle) => bundle.slug === slug)
}

/** Expand a set of enabled product slugs to include implied capabilities. */
export function expandEnabledModuleSlugs(
  productSlugs: Iterable<string>,
  impliedByProduct?: Record<string, readonly string[]>
): Set<string> {
  const enabled = new Set<string>()

  for (const rawSlug of productSlugs) {
    const slug = normalizeModuleSlug(rawSlug)
    if (!slug || isCoreModuleSlug(slug) || isCapabilityModuleSlug(slug)) continue
    enabled.add(slug)

    for (const implied of getProductImpliedCapabilitySlugs(slug, impliedByProduct)) {
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
  enabled: boolean,
  impliedByProduct?: Record<string, readonly string[]>
): string[] {
  const slug = normalizeModuleSlug(moduleSlug)
  const targets = new Set<string>([slug])
  void enabled

  for (const implied of getProductImpliedCapabilitySlugs(slug, impliedByProduct)) {
    targets.add(implied)
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

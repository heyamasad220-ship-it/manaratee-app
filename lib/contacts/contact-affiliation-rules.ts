import type { ContactRoleValue } from "@/lib/contacts/contact-constants"

/** Terminal program enrollment statuses — do not confer Programs affiliation. */
export const PROGRAM_PARTICIPANT_TERMINAL_STATUSES = [
  "cancelled",
  "withdrawn",
  "transferred",
] as const

/** Venue rental statuses that do not confer customer. */
export const VENUE_RENTAL_CUSTOMER_EXCLUDED_STATUSES = [
  "draft",
  "declined",
  "hold_expired",
  "cancelled_before_payment",
  "cancelled_after_payment",
] as const

/** Affiliation roles computed automatically from activity (not manually assigned). */
export const DERIVED_AFFILIATION_ROLES = [
  "donor",
  "volunteer",
  "employee",
  "member",
  "vendor",
  "childcare_provider",
  "customer",
  "program_participant",
] as const satisfies readonly ContactRoleValue[]

export type DerivedAffiliationRole = (typeof DERIVED_AFFILIATION_ROLES)[number]

/** Roles automatic sync may remove when activity no longer qualifies. */
export const AUTO_REMOVABLE_DERIVED_ROLES: DerivedAffiliationRole[] = [
  "employee",
  "member",
  "childcare_provider",
]

/** Roles that stick once earned (never auto-removed by sync). */
export const STICKY_DERIVED_ROLES: DerivedAffiliationRole[] = [
  "donor",
  "volunteer",
  "vendor",
  "customer",
  "program_participant",
]

/** Application types that trigger affiliation sync on submit or status change. */
export const AFFILIATION_APPLICATION_TYPES = ["vendor", "childcare_provider"] as const

export type AffiliationRuleDefinition = {
  role: DerivedAffiliationRole
  label: string
  trigger: string
  autoAdd: string
  autoRemove: string
  moduleList: string
  /** Product module slugs required for this affiliation (any match enables by default). */
  moduleSlugs: readonly string[]
}

/** Module slugs that gate each derived affiliation when no org override exists. */
export const AFFILIATION_ROLE_MODULE_SLUGS: Record<
  DerivedAffiliationRole,
  readonly string[]
> = {
  donor: ["donations"],
  vendor: ["vendor-hub", "bazaar"],
  childcare_provider: ["workforce", "child-care", "applications", "hr"],
  volunteer: ["workforce", "hr"],
  employee: ["workforce", "hr"],
  member: ["membership"],
  program_participant: ["programs"],
  customer: ["event-management", "ticketing", "bookings"],
}

function normalizeAffiliationModuleSlug(slug: string): string {
  if (slug === "bazaar") return "vendor-hub"
  if (slug === "hr") return "workforce"
  return slug
}

export function isAffiliationModuleAvailable(
  role: DerivedAffiliationRole,
  enabledSlugs: Set<string>
): boolean {
  const normalizedEnabled = new Set(
    Array.from(enabledSlugs, (slug) => normalizeAffiliationModuleSlug(slug))
  )
  return AFFILIATION_ROLE_MODULE_SLUGS[role].some((slug) =>
    normalizedEnabled.has(normalizeAffiliationModuleSlug(slug))
  )
}

export function defaultAffiliationAutoSyncEnabled(
  role: DerivedAffiliationRole,
  enabledSlugs: Set<string>
): boolean {
  return isAffiliationModuleAvailable(role, enabledSlugs)
}

/** Documented policies — defaults follow subscribed modules; staff override in Contacts → Settings. */
export const AFFILIATION_RULE_DEFINITIONS: AffiliationRuleDefinition[] = [
  {
    role: "donor",
    label: "Donor",
    trigger: "Any linked donation payment (pledge alone does not qualify)",
    autoAdd: "Yes — on first payment",
    autoRemove: "Never — once a donor, always a donor",
    moduleList: "Donations → Donors",
    moduleSlugs: AFFILIATION_ROLE_MODULE_SLUGS.donor,
  },
  {
    role: "vendor",
    label: "Vendor",
    trigger: "Approved vendor application or linked vendor record",
    autoAdd: "Yes — on approval or first vendor record",
    autoRemove: "Never — once a vendor, always a vendor",
    moduleList: "Vendor Hub → Vendors",
    moduleSlugs: AFFILIATION_ROLE_MODULE_SLUGS.vendor,
  },
  {
    role: "childcare_provider",
    label: "Child Care Provider",
    trigger: "Approved childcare provider application",
    autoAdd: "Yes — when application is approved",
    autoRemove: "Yes — when no approved application remains (unless manually overridden)",
    moduleList: "Workforce → Child Care Providers",
    moduleSlugs: AFFILIATION_ROLE_MODULE_SLUGS.childcare_provider,
  },
  {
    role: "volunteer",
    label: "Volunteer",
    trigger: "Any volunteer roster record for this contact",
    autoAdd: "Yes — when added to volunteer roster",
    autoRemove: "Never — kept for history",
    moduleList: "Workforce → Volunteers",
    moduleSlugs: AFFILIATION_ROLE_MODULE_SLUGS.volunteer,
  },
  {
    role: "employee",
    label: "Employee",
    trigger: "Active staff record linked to this contact",
    autoAdd: "Yes — when staff is active",
    autoRemove: "Yes — when staff is inactive or removed (unless manually overridden)",
    moduleList: "Workforce → Employees",
    moduleSlugs: AFFILIATION_ROLE_MODULE_SLUGS.employee,
  },
  {
    role: "member",
    label: "Member",
    trigger: "Active membership record",
    autoAdd: "Yes — when membership is active",
    autoRemove: "Yes — when membership lapses (unless manually overridden)",
    moduleList: "Membership → Members",
    moduleSlugs: AFFILIATION_ROLE_MODULE_SLUGS.member,
  },
  {
    role: "program_participant",
    label: "Programs",
    trigger:
      "Program enrollment as participant, registrant (parent/guardian), or payer — or a paid program charge",
    autoAdd: "Yes — on enrollment or program payment",
    autoRemove: "Never — program history retained",
    moduleList: "Programs → Registrations",
    moduleSlugs: AFFILIATION_ROLE_MODULE_SLUGS.program_participant,
  },
  {
    role: "customer",
    label: "Customer",
    trigger:
      "Completed ticket purchase, or linked venue rental (billing contact)",
    autoAdd: "Yes — on purchase or rental request",
    autoRemove: "Never — customer history retained",
    moduleList: "Events → Ticketing, Bookings → Venue Rentals",
    moduleSlugs: AFFILIATION_ROLE_MODULE_SLUGS.customer,
  },
]

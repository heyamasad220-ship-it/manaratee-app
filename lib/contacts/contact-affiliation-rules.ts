import type { ContactRoleValue } from "@/lib/contacts/contact-constants"

/** Affiliation roles computed automatically from activity (not manually assigned). */
export const DERIVED_AFFILIATION_ROLES = [
  "donor",
  "volunteer",
  "employee",
  "member",
  "vendor",
  "childcare_provider",
] as const satisfies readonly ContactRoleValue[]

export type DerivedAffiliationRole = (typeof DERIVED_AFFILIATION_ROLES)[number]

/** Roles automatic sync may remove when activity no longer qualifies. */
export const AUTO_REMOVABLE_DERIVED_ROLES: DerivedAffiliationRole[] = [
  "employee",
  "member",
  "childcare_provider",
]

/** Roles that stick once earned (never auto-removed by sync). */
export const STICKY_DERIVED_ROLES: DerivedAffiliationRole[] = ["donor", "volunteer", "vendor"]

/** Application types that trigger affiliation sync on submit or status change. */
export const AFFILIATION_APPLICATION_TYPES = ["vendor", "childcare_provider"] as const

export type AffiliationRuleDefinition = {
  role: DerivedAffiliationRole
  label: string
  trigger: string
  autoAdd: string
  autoRemove: string
  moduleList: string
}

/** Documented policies — configured per product decisions (Contacts → Settings). */
export const AFFILIATION_RULE_DEFINITIONS: AffiliationRuleDefinition[] = [
  {
    role: "donor",
    label: "Donor",
    trigger: "Any linked donation payment or donor record",
    autoAdd: "Yes — on first gift",
    autoRemove: "Never — once a donor, always a donor",
    moduleList: "Donations → Donors",
  },
  {
    role: "vendor",
    label: "Vendor",
    trigger: "Approved vendor application or linked vendor record",
    autoAdd: "Yes — on approval or first vendor record",
    autoRemove: "Never — once a vendor, always a vendor",
    moduleList: "Vendor Hub → Vendors",
  },
  {
    role: "childcare_provider",
    label: "Child Care Provider",
    trigger: "Approved childcare provider application",
    autoAdd: "Yes — when application is approved",
    autoRemove: "Yes — when no approved application remains (unless manually overridden)",
    moduleList: "Workforce → Child Care Providers",
  },
  {
    role: "volunteer",
    label: "Volunteer",
    trigger: "Any volunteer roster record for this contact",
    autoAdd: "Yes — when added to volunteer roster",
    autoRemove: "Never — kept for history",
    moduleList: "Workforce → Volunteers",
  },
  {
    role: "employee",
    label: "Employee",
    trigger: "Active staff record linked to this contact",
    autoAdd: "Yes — when staff is active",
    autoRemove: "Yes — when staff is inactive or removed (unless manually overridden)",
    moduleList: "Workforce → Employees",
  },
  {
    role: "member",
    label: "Member",
    trigger: "Active membership record",
    autoAdd: "Yes — when membership is active",
    autoRemove: "Yes — when membership lapses (unless manually overridden)",
    moduleList: "Membership → Members",
  },
]

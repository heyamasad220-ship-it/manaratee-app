import type { ContactRoleValue } from "@/lib/contacts/contact-constants"
import { ROLE_VALUE_TO_LABEL } from "@/lib/contacts/contact-constants"

/**
 * Directory role views are filtered lookups of canonical contacts/organizations.
 * Most keys map to `contact_roles.role`. Parent and rental customer are derived
 * from household / venue rental activity and are not stored as contact_roles.
 */
export const DIRECTORY_DYNAMIC_ROLE_DEFS = [
  {
    key: "employees",
    label: "Employees",
    contactRole: "employee" as const,
    source: "contact_roles" as const,
    operationalHref: "/workforce/employees",
    operationalLabel: "Open Workforce",
  },
  {
    key: "volunteers",
    label: "Volunteers",
    contactRole: "volunteer" as const,
    source: "contact_roles" as const,
    operationalHref: "/workforce/volunteers",
    operationalLabel: "Open Workforce",
  },
  {
    key: "members",
    label: "Members",
    contactRole: "member" as const,
    source: "contact_roles" as const,
    operationalHref: "/membership/members",
    operationalLabel: "Open Membership",
  },
  {
    key: "donors",
    label: "Donors",
    contactRole: "donor" as const,
    source: "contact_roles" as const,
    operationalHref: "/donations/reports/donors",
    operationalLabel: "Open Fund Development",
  },
  {
    key: "sponsors",
    label: "Sponsors",
    contactRole: "sponsor" as const,
    source: "contact_roles" as const,
    operationalHref: "/donations/campaigns",
    operationalLabel: "Open Fund Development",
  },
  {
    key: "parents",
    label: "Parents",
    contactRole: null,
    source: "parents" as const,
    operationalHref: null,
    operationalLabel: null,
  },
  {
    key: "vendors",
    label: "Vendors",
    contactRole: "vendor" as const,
    source: "contact_roles" as const,
    operationalHref: "/vendor-hub/network/vendors",
    operationalLabel: "Open Vendor Hub",
  },
  {
    key: "service-providers",
    label: "Service Providers",
    contactRole: "service_provider" as const,
    source: "contact_roles" as const,
    operationalHref: "/workforce/service-providers",
    operationalLabel: "Open Workforce",
    requiresFacilities: true,
    emptyDescription:
      "Contractors the organization uses — plumbers, pest control, cleaning, HVAC, and similar building services. This is separate from event vendors in Vendor Hub.",
  },
  {
    key: "childcare-providers",
    label: "Childcare Providers",
    contactRole: "childcare_provider" as const,
    source: "contact_roles" as const,
    operationalHref: "/workforce/childcare",
    operationalLabel: "Open Workforce",
  },
  {
    key: "rental-customers",
    label: "Rental Customers",
    contactRole: null,
    source: "rental_customers" as const,
    operationalHref: "/bookings/requests",
    operationalLabel: "Open Venue Rentals",
  },
] as const

export type DirectoryDynamicRoleKey = (typeof DIRECTORY_DYNAMIC_ROLE_DEFS)[number]["key"]

export type DirectoryRoleCountMap = Partial<Record<DirectoryDynamicRoleKey, number>>

export type DirectoryNavSummary = {
  people: number
  families: number
  organizations: number
  groups: number
  roles: DirectoryRoleCountMap
  facilitiesEnabled: boolean
}

export type DirectoryRoleNavOptions = {
  facilitiesEnabled?: boolean
  /** Directory flyout/overview: hide roles owned by Administration or Fund Development. */
  directoryNav?: boolean
}

const DIRECTORY_NAV_HIDDEN_ROLE_KEYS = new Set<DirectoryDynamicRoleKey>([
  "employees",
  "volunteers",
  "donors",
  "childcare-providers",
  "service-providers",
])

const ROLE_BY_KEY = new Map(
  DIRECTORY_DYNAMIC_ROLE_DEFS.map((def) => [def.key, def] as const)
)

export function isDirectoryDynamicRoleKey(
  value: string | null | undefined
): value is DirectoryDynamicRoleKey {
  return Boolean(value && ROLE_BY_KEY.has(value as DirectoryDynamicRoleKey))
}

export function getDirectoryRoleDef(key: DirectoryDynamicRoleKey) {
  return ROLE_BY_KEY.get(key)!
}

export function directoryRolePath(key: DirectoryDynamicRoleKey) {
  return `/directory/role/${key}`
}

export function directoryRolesFromContactRoles(
  roles: Array<ContactRoleValue | string>
): string[] {
  const labels: string[] = []
  for (const role of roles) {
    if (role === "parent") {
      labels.push("Parent")
      continue
    }
    if (role === "rental_customer") {
      labels.push("Rental Customer")
      continue
    }
    const label = ROLE_VALUE_TO_LABEL[role as ContactRoleValue]
    if (label) labels.push(label)
  }
  return Array.from(new Set(labels))
}

/** Roles staff may assign from Directory add/edit (not membership/customer/programs). */
export const DIRECTORY_PERSON_ASSIGNABLE_ROLES: ContactRoleValue[] = [
  "donor",
  "sponsor",
  "volunteer",
  "employee",
  "vendor",
  "service_provider",
  "childcare_provider",
]

export const DIRECTORY_ORGANIZATION_ASSIGNABLE_ROLES: ContactRoleValue[] = [
  "donor",
  "sponsor",
  "vendor",
  "service_provider",
  "customer",
]

export function getDirectoryAssignableRoles(
  recordType: "individual" | "organization" | "group",
  options: DirectoryRoleNavOptions = {}
): { value: ContactRoleValue; label: string }[] {
  const values =
    recordType === "organization" || recordType === "group"
      ? DIRECTORY_ORGANIZATION_ASSIGNABLE_ROLES
      : DIRECTORY_PERSON_ASSIGNABLE_ROLES

  return values
    .filter(
      (value) => value !== "service_provider" || Boolean(options.facilitiesEnabled)
    )
    .map((value) => ({
      value,
      label: ROLE_VALUE_TO_LABEL[value],
    }))
}

export function populatedDirectoryRoles(
  counts: DirectoryRoleCountMap,
  options: DirectoryRoleNavOptions = {}
) {
  return DIRECTORY_DYNAMIC_ROLE_DEFS.filter((def) => {
    if (options.directoryNav && DIRECTORY_NAV_HIDDEN_ROLE_KEYS.has(def.key)) {
      return false
    }
    if (def.key === "service-providers") {
      return Boolean(options.facilitiesEnabled)
    }
    return (counts[def.key] ?? 0) > 0
  })
}

export type DirectoryRoleExtraColumn = {
  key: string
  label: string
}

/** Lightweight lookup columns for Directory role views — not full operational records. */
export function directoryRoleExtraColumns(
  key: DirectoryDynamicRoleKey
): DirectoryRoleExtraColumn[] {
  switch (key) {
    case "employees":
      return [
        { key: "department", label: "Department" },
        { key: "position", label: "Position" },
        { key: "employmentType", label: "Employment type" },
        { key: "roleStatus", label: "Workforce status" },
      ]
    case "volunteers":
      return [
        { key: "groups", label: "Groups" },
        { key: "roleStatus", label: "Volunteer status" },
      ]
    case "members":
      return [
        { key: "membershipType", label: "Membership type" },
        { key: "roleStatus", label: "Membership status" },
        { key: "dates", label: "Dates" },
        { key: "household", label: "Household" },
      ]
    case "donors":
      return [
        { key: "lifetimeGiving", label: "Lifetime giving" },
        { key: "lastGift", label: "Last gift" },
        { key: "activePledge", label: "Active pledge" },
      ]
    case "parents":
      return [
        { key: "household", label: "Household" },
        { key: "children", label: "Children" },
      ]
    case "vendors":
      return [
        { key: "vendorType", label: "Vendor type" },
        { key: "primaryContact", label: "Primary contact" },
      ]
    case "service-providers":
      return [{ key: "roleStatus", label: "Status" }]
    case "childcare-providers":
      return [
        { key: "position", label: "Position" },
        { key: "roleStatus", label: "Status" },
      ]
    case "rental-customers":
      return [
        { key: "rentalCount", label: "Rentals" },
        { key: "lastRental", label: "Last rental" },
      ]
    case "sponsors":
      return []
    default:
      return []
  }
}

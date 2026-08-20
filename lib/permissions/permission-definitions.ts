import { CORE_MODULE_SLUGS, normalizeModuleSlug } from "@/lib/modules/module-catalog"

export type PermissionDefinition = {
  key: string
  label: string
  description: string
  group: string
  /** When true, always shown (e.g. Settings). */
  alwaysAvailable?: boolean
  /** At least one slug must be enabled for the org (core slugs are always treated as enabled). */
  moduleSlugs: string[]
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: "settings.users.view",
    label: "View Users",
    description: "Can open the Users page.",
    group: "Settings",
    alwaysAvailable: true,
    moduleSlugs: ["settings"],
  },
  {
    key: "settings.users.manage",
    label: "Manage Users",
    description: "Can invite users and change user roles.",
    group: "Settings",
    alwaysAvailable: true,
    moduleSlugs: ["settings"],
  },
  {
    key: "settings.roles.view",
    label: "View Roles & Permissions",
    description: "Can open the Roles & Permissions page.",
    group: "Settings",
    alwaysAvailable: true,
    moduleSlugs: ["settings"],
  },
  {
    key: "settings.roles.manage",
    label: "Manage Roles & Permissions",
    description: "Can create roles and edit permissions.",
    group: "Settings",
    alwaysAvailable: true,
    moduleSlugs: ["settings"],
  },
  {
    key: "contacts.view",
    label: "View Contacts",
    description: "Can open Contacts pages and view contact records.",
    group: "Contacts",
    moduleSlugs: ["contacts"],
  },
  {
    key: "contacts.manage",
    label: "Manage Contacts",
    description: "Can create, edit, and delete contacts and affiliations.",
    group: "Contacts",
    moduleSlugs: ["contacts"],
  },
  {
    key: "donations.view",
    label: "View Donations",
    description: "Can open donation and fundraising pages.",
    group: "Donations",
    moduleSlugs: ["donations"],
  },
  {
    key: "donations.manage",
    label: "Manage Donations",
    description: "Can create, import, reconcile, and update donations.",
    group: "Donations",
    moduleSlugs: ["donations"],
  },
  {
    key: "applications.view",
    label: "View Applications",
    description: "Can open the Applications page.",
    group: "Applications",
    moduleSlugs: ["applications"],
  },
  {
    key: "applications.manage",
    label: "Manage Applications",
    description: "Can approve, reject, and update applications.",
    group: "Applications",
    moduleSlugs: ["applications"],
  },
  {
    key: "programs.view",
    label: "View Programs",
    description: "Can open Programs pages.",
    group: "Programs",
    moduleSlugs: ["programs"],
  },
  {
    key: "programs.manage",
    label: "Manage Programs",
    description: "Can create and edit programs.",
    group: "Programs",
    moduleSlugs: ["programs"],
  },
  {
    key: "staff.view",
    label: "View Staff",
    description: "Can open Staff/Instructors pages.",
    group: "Staff",
    moduleSlugs: ["workforce"],
  },
  {
    key: "staff.manage",
    label: "Manage Staff",
    description: "Can create, edit, and delete staff records.",
    group: "Staff",
    moduleSlugs: ["workforce"],
  },
  {
    key: "reports.view",
    label: "View Reports",
    description: "Can open reports.",
    group: "Reports",
    moduleSlugs: ["event-management", "programs", "reports"],
  },
  {
    key: "events.view",
    label: "View Events",
    description: "Can open Event Management pages.",
    group: "Events",
    moduleSlugs: ["event-management"],
  },
  {
    key: "events.checkin",
    label: "Check in attendees",
    description:
      "Can scan tickets and check attendees (and youth) in or out. Does not allow editing events, refunds, or registration settings.",
    group: "Events",
    moduleSlugs: ["event-management"],
  },
  {
    key: "events.manage",
    label: "Manage Events",
    description: "Can create and edit internal events and event types.",
    group: "Events",
    moduleSlugs: ["event-management"],
  },
  {
    key: "ticketing.view",
    label: "View Ticketing",
    description: "Can open ticketing and event sales pages.",
    group: "Events",
    moduleSlugs: ["event-management", "ticketing"],
  },
  {
    key: "ticketing.manage",
    label: "Manage Ticketing",
    description: "Can create and complete ticket orders.",
    group: "Events",
    moduleSlugs: ["event-management", "ticketing"],
  },
  {
    key: "membership.view",
    label: "View Membership",
    description: "Can open membership pages and view members.",
    group: "Membership",
    moduleSlugs: ["membership"],
  },
  {
    key: "membership.manage",
    label: "Manage Membership",
    description: "Can add members, create memberships, and update status.",
    group: "Membership",
    moduleSlugs: ["membership"],
  },
  {
    key: "bookings.view",
    label: "View Venue Rentals",
    description: "Can open Venue Rentals pages.",
    group: "Venue Rentals",
    moduleSlugs: ["bookings"],
  },
  {
    key: "bookings.manage",
    label: "Manage Venue Rentals",
    description: "Can approve, edit, and manage venue rental workflows.",
    group: "Venue Rentals",
    moduleSlugs: ["bookings"],
  },
  {
    key: "spaces.view",
    label: "View Facilities",
    description: "Can open Facilities pages, master calendar, and setup briefs.",
    group: "Facilities",
    moduleSlugs: ["spaces", "bookings"],
  },
  {
    key: "spaces.manage",
    label: "Manage Facilities",
    description: "Can manage spaces and update facility setup notes.",
    group: "Facilities",
    moduleSlugs: ["spaces", "bookings"],
  },
  {
    key: "vendor_hub.view",
    label: "View Vendor Hub",
    description: "Can open Vendor Hub pages.",
    group: "Vendor Hub",
    moduleSlugs: ["vendor-hub"],
  },
  {
    key: "vendor_hub.manage",
    label: "Manage Vendor Hub",
    description: "Can manage vendors, booths, and marketplace settings.",
    group: "Vendor Hub",
    moduleSlugs: ["vendor-hub"],
  },
  {
    key: "finance.view",
    label: "View Finance",
    description: "Can open finance pages.",
    group: "Finance",
    moduleSlugs: ["finance"],
  },
  {
    key: "finance.manage",
    label: "Manage Finance",
    description: "Can update finance records and settings.",
    group: "Finance",
    moduleSlugs: ["finance"],
  },
]

function buildEnabledModuleSlugSet(enabledModuleSlugs: Iterable<string>) {
  const enabled = new Set([...enabledModuleSlugs].map(normalizeModuleSlug))
  for (const coreSlug of CORE_MODULE_SLUGS) {
    enabled.add(coreSlug)
  }
  return enabled
}

export function isPermissionAvailableForOrganization(
  permission: PermissionDefinition,
  enabledModuleSlugs: Iterable<string>
) {
  if (permission.alwaysAvailable) {
    return true
  }

  const enabled = buildEnabledModuleSlugSet(enabledModuleSlugs)
  return permission.moduleSlugs.some((slug) => enabled.has(normalizeModuleSlug(slug)))
}

export function filterPermissionDefinitionsForOrganization(
  enabledModuleSlugs: Iterable<string>,
  definitions: PermissionDefinition[] = PERMISSION_DEFINITIONS
) {
  return definitions.filter((permission) =>
    isPermissionAvailableForOrganization(permission, enabledModuleSlugs)
  )
}

export function permissionGroupsForDefinitions(definitions: PermissionDefinition[]) {
  return Array.from(new Set(definitions.map((permission) => permission.group)))
}

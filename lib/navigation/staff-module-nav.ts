import type { SubItem } from "@/lib/navigation/sidebar-nav"
import type { OrganizationProgramKindsEntitlement } from "@/lib/programs/program-kind-policy"

export const ADMINISTRATION_MODULE_LABEL = "Administration"
export const ADMINISTRATION_MODULE_SLUG = "administration"

export type StaffModuleSlugSet = ReadonlySet<string>

function hasPrograms(slugs: StaffModuleSlugSet) {
  return slugs.has("programs")
}

function hasEventManagement(slugs: StaffModuleSlugSet) {
  return slugs.has("event-management")
}

function hasFacilities(slugs: StaffModuleSlugSet) {
  return slugs.has("spaces")
}

function hasWorkforceOpsDemand(slugs: StaffModuleSlugSet) {
  return hasPrograms(slugs) || hasEventManagement(slugs)
}

/** Top-level product modules replaced by Administration or Programs. */
export function isHiddenTopLevelStaffModule(
  slug: string,
  slugs: StaffModuleSlugSet
) {
  if (slug === "workforce" || slug === "hr") return true
  if (slug === "community-calendar") return true
  if (slug === "finance" && hasPrograms(slugs)) return true
  return false
}

export function buildAdministrationChildren(slugs: StaffModuleSlugSet): SubItem[] {
  const items: SubItem[] = [
    {
      label: "Departments",
      href: "/workforce/departments",
      matchPrefix: "/workforce/departments",
      permissionKey: "staff.view",
    },
    {
      label: "Employees",
      href: "/workforce/employees",
      matchPrefix: "/workforce/employees",
      permissionKey: "staff.view",
    },
  ]

  if (hasWorkforceOpsDemand(slugs)) {
    items.push(
      {
        label: "Volunteers",
        href: "/workforce/volunteers",
        matchPrefix: "/workforce/volunteers",
        permissionKey: "staff.view",
      },
      {
        label: "Child Care Providers",
        href: "/workforce/childcare",
        matchPrefix: "/workforce/childcare",
        permissionKey: "staff.view",
      }
    )
  }

  if (hasFacilities(slugs)) {
    items.push({
      label: "Service Providers",
      href: "/workforce/service-providers",
      matchPrefix: "/workforce/service-providers",
      permissionKey: "staff.view",
      permissionKeys: ["staff.view", "spaces.view"],
      dividerBefore: items.length > 0,
    })
  }

  return items
}

export function buildProgramsChildren(
  _entitlement: OrganizationProgramKindsEntitlement
): SubItem[] {
  return []
}

export function buildEventManagementChildren(): SubItem[] {
  return [
    {
      label: "Overview",
      href: "/event-management",
      matchPrefix: "/event-management",
      exact: true,
      permissionKey: "events.view",
    },
    {
      label: "Events",
      href: "/event-management/events",
      matchPrefix: "/event-management",
      excludeMatchPrefixes: [
        "/event-management/calendar",
        "/event-management/check-in",
        "/event-management/ticketing",
        "/event-management/settings",
        "/event-management/reports",
      ],
      permissionKey: "events.view",
    },
    {
      label: "Master Calendar",
      href: "/event-management/calendar",
      matchPrefix: "/event-management/calendar",
      permissionKey: "events.view",
    },
    {
      label: "Check-in",
      href: "/event-management/check-in",
      matchPrefix: "/event-management/check-in",
      permissionKey: "events.view",
      permissionKeys: ["events.view", "events.checkin", "ticketing.view"],
    },
    {
      label: "Reports",
      href: "/event-management/reports",
      matchPrefix: "/event-management/reports",
      permissionKey: "events.view",
    },
    {
      label: "Settings",
      href: "/event-management/settings/notifications",
      matchPrefix: "/event-management/settings",
      permissionKey: "events.manage",
    },
  ]
}

export function buildFinanceChildren(): SubItem[] {
  return [
    {
      label: "Financial Assistance",
      href: "/finance/financial-assistance",
      matchPrefix: "/finance/financial-assistance",
      alsoMatchPrefixes: ["/programs/financial-assistance"],
      permissionKey: "applications.view",
      permissionKeys: ["finance.view", "applications.view"],
    },
    {
      label: "Transactions",
      href: "/finance/transactions",
      matchPrefix: "/finance/transactions",
      permissionKey: "finance.view",
    },
    {
      label: "Payroll",
      href: "/finance/payroll",
      matchPrefix: "/finance/payroll",
      permissionKey: "staff.view",
    },
  ]
}

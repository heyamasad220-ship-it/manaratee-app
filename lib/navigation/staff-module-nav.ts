import type { SubItem } from "@/lib/navigation/sidebar-nav"
import type { OrganizationProgramKindsEntitlement } from "@/lib/programs/program-kind-policy"
import {
  PROGRAMS_FINANCE_PATH,
  PROGRAMS_FINANCE_PAYROLL_PATH,
  PROGRAMS_FINANCIAL_ASSISTANCE_PATH,
  PROGRAMS_LIST_PATH,
  PROGRAMS_OVERVIEW_PATH,
  PROGRAMS_REGISTRATIONS_PATH,
  PROGRAMS_REPORTS_PATH,
  PROGRAMS_SETTINGS_PATH,
} from "@/lib/programs/programs-module-nav"

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

/** Administration is a Programs / Event Management capability, not a core rail item. */
export function isAdministrationNavEnabled(slugs: StaffModuleSlugSet) {
  return hasWorkforceOpsDemand(slugs)
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
  return [
    {
      label: "Overview",
      href: PROGRAMS_OVERVIEW_PATH,
      matchPrefix: PROGRAMS_OVERVIEW_PATH,
      exact: true,
      permissionKey: "programs.view",
    },
    {
      label: "All programs",
      href: PROGRAMS_LIST_PATH,
      matchPrefix: "/programs",
      excludeMatchPrefixes: [
        PROGRAMS_REGISTRATIONS_PATH,
        "/programs/reports",
        PROGRAMS_SETTINGS_PATH,
        "/programs/catalog",
        "/programs/financial-assistance",
        "/programs/instructors",
        "/programs/calendar",
        "/programs/schedule",
        "/programs/participants",
      ],
      permissionKey: "programs.view",
    },
    {
      label: "Registrations",
      href: PROGRAMS_REGISTRATIONS_PATH,
      matchPrefix: PROGRAMS_REGISTRATIONS_PATH,
      permissionKey: "programs.view",
    },
    {
      label: "Finance",
      href: PROGRAMS_FINANCE_PATH,
      matchPrefix: PROGRAMS_FINANCE_PATH,
      alsoMatchPrefixes: [PROGRAMS_FINANCE_PAYROLL_PATH],
      permissionKey: "finance.view",
      permissionKeys: ["finance.view", "reports.view"],
    },
    {
      label: "Financial Assistance",
      href: PROGRAMS_FINANCIAL_ASSISTANCE_PATH,
      matchPrefix: PROGRAMS_FINANCIAL_ASSISTANCE_PATH,
      alsoMatchPrefixes: ["/programs/financial-assistance"],
      permissionKey: "applications.view",
      permissionKeys: ["finance.view", "applications.view"],
    },
    {
      label: "Reports",
      href: PROGRAMS_REPORTS_PATH,
      matchPrefix: "/programs/reports",
      permissionKey: "programs.view",
    },
    {
      label: "Settings",
      href: PROGRAMS_SETTINGS_PATH,
      matchPrefix: PROGRAMS_SETTINGS_PATH,
      permissionKey: "programs.view",
    },
  ]
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

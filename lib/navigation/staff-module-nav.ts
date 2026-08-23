import type { SubItem } from "@/lib/navigation/sidebar-nav"
import {
  organizationProgramKindToggles,
  type OrganizationProgramKindsEntitlement,
} from "@/lib/programs/program-kind-policy"

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
  entitlement: OrganizationProgramKindsEntitlement
): SubItem[] {
  const { academic: allowAcademic, seasonal: allowSeasonal } =
    organizationProgramKindToggles(entitlement)
  const items: SubItem[] = []

  if (allowAcademic) {
    items.push({
      label: "Academic",
      href: "/programs/catalog?kind=academic",
      matchPrefix: "/programs/catalog",
      permissionKey: "programs.view",
    })
  }

  if (allowSeasonal) {
    items.push({
      label: "Seasonal",
      href: "/programs/catalog?kind=seasonal",
      matchPrefix: "/programs/catalog",
      permissionKey: "programs.view",
    })
  }

  items.push(
    {
      label: "Financial Assistance",
      href: "/finance/financial-assistance",
      matchPrefix: "/finance/financial-assistance",
      alsoMatchPrefixes: ["/programs/financial-assistance"],
      permissionKey: "applications.view",
      permissionKeys: ["finance.view", "applications.view"],
    },
    {
      label: "Reports",
      href: "/programs/registrations",
      matchPrefix: "/programs/registrations",
      alsoMatchPrefixes: [
        "/programs/reports",
        "/finance/transactions",
        "/finance/payroll",
      ],
      permissionKey: "reports.view",
      permissionKeys: ["reports.view", "finance.view", "staff.view"],
    }
  )

  return items
}

export function buildEventManagementChildren(): SubItem[] {
  return [
    {
      label: "Events",
      href: "/event-management",
      matchPrefix: "/event-management",
      excludeMatchPrefixes: [
        "/event-management/calendar",
        "/event-management/ticketing",
        "/event-management/settings",
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
      label: "Ticketing",
      href: "/event-management/ticketing",
      matchPrefix: "/event-management/ticketing",
      permissionKey: "ticketing.view",
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

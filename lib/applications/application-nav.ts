import type { ModuleOwner } from "@/lib/applications/application-types"
import {
  HR_EMPLOYEE_APPLICATIONS_PATH,
  PROGRAMS_FINANCIAL_ASSISTANCE_PATH,
  VENDOR_HUB_APPLICATIONS_PATH,
  hrCategoryApplicationsUrl,
} from "@/lib/applications/application-routes"

export type ApplicationNavItem = {
  label: string
  href: string
  matchPrefix: string
  permissionKey?: string
}

/** @deprecated Settings Applications hub removed — use HR category Applications tabs. */
export function hrApplicationNavItems(): ApplicationNavItem[] {
  return [
    {
      label: "Employment Applications",
      href: hrCategoryApplicationsUrl({ applicationType: "employment" }),
      matchPrefix: HR_EMPLOYEE_APPLICATIONS_PATH,
      permissionKey: "applications.view",
    },
  ]
}

export function vendorApplicationNavItem(): ApplicationNavItem {
  return {
    label: "Applications",
    href: VENDOR_HUB_APPLICATIONS_PATH,
    matchPrefix: VENDOR_HUB_APPLICATIONS_PATH,
    permissionKey: "applications.view",
  }
}

export function programsFinancialAssistanceNavItem(): ApplicationNavItem {
  return {
    label: "Financial Assistance",
    href: PROGRAMS_FINANCIAL_ASSISTANCE_PATH,
    matchPrefix: PROGRAMS_FINANCIAL_ASSISTANCE_PATH,
    permissionKey: "applications.view",
  }
}

export function moduleOwnerFromScope(
  moduleOwner?: ModuleOwner | null,
  applicationType?: string | null
): ModuleOwner | undefined {
  if (moduleOwner) return moduleOwner
  if (applicationType === "vendor") return "vendor_hub"
  if (applicationType === "financial_aid") return "programs"
  if (
    applicationType === "employment" ||
    applicationType === "committee_member" ||
    applicationType === "childcare_provider" ||
    applicationType === "volunteer"
  ) {
    return "workforce"
  }
  return undefined
}

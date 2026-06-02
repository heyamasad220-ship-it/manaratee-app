import type { ModuleOwner } from "@/lib/applications/application-types"
import {
  moduleApplicationsUrl,
  PEOPLE_MANAGEMENT_APPLICATIONS_PATH,
} from "@/lib/applications/application-routes"

export type ApplicationNavItem = {
  label: string
  href: string
  matchPrefix: string
  permissionKey?: string
}

/** Single Applications entry under People Management (between Teams and Settings). */
export function hrApplicationNavItems(): ApplicationNavItem[] {
  return [
    {
      label: "Applications",
      href: PEOPLE_MANAGEMENT_APPLICATIONS_PATH,
      matchPrefix: PEOPLE_MANAGEMENT_APPLICATIONS_PATH,
      permissionKey: "applications.view",
    },
  ]
}

export function vendorApplicationNavItem(): ApplicationNavItem {
  return {
    label: "Applications",
    href: moduleApplicationsUrl({ applicationType: "vendor" }),
    matchPrefix: "/applications/all",
    permissionKey: "applications.view",
  }
}

export function programsFinancialAssistanceNavItem(): ApplicationNavItem {
  return {
    label: "Financial Assistance",
    href: moduleApplicationsUrl({ applicationType: "financial_aid" }),
    matchPrefix: "/applications/all",
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
    applicationType === "volunteer" ||
    applicationType === "employment" ||
    applicationType === "committee_member" ||
    applicationType === "childcare_provider"
  ) {
    return "hr"
  }
  return undefined
}

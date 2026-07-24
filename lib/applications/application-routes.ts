import type { ApplicationStatus, ModuleOwner } from "@/lib/applications/application-types"
import { isWorkforceModuleOwner } from "@/lib/applications/application-types"
import type { ApplicationStatusTabId } from "@/lib/applications/application-status-tabs"
import {
  hrOverviewHref,
  hrOverviewTabFromApplicationType,
  HR_OVERVIEW_PATH,
} from "@/lib/hr/hr-overview-path"

/** @deprecated Hub removed — redirects to HR category Applications tabs. */
export const PEOPLE_MANAGEMENT_APPLICATIONS_PATH = "/settings/applications"
/** @deprecated Templates hub removed — redirects resolve to HR Overview. */
export const HR_APPLICATION_TEMPLATES_PATH = "/workforce"
/** Base overview path; use hrCategoryApplicationsUrl for Applications deep links. */
export const HR_EMPLOYEE_APPLICATIONS_PATH = HR_OVERVIEW_PATH
export const HR_VOLUNTEER_APPLICATIONS_PATH = HR_OVERVIEW_PATH
export const HR_CHILDCARE_APPLICATIONS_PATH = HR_OVERVIEW_PATH
/** @deprecated Use MEMBERSHIP_APPLICATIONS_PATH — committee apps live under Membership. */
export const HR_COMMITTEE_APPLICATIONS_PATH = "/workforce/settings/committee-applications"
export const MEMBERSHIP_APPLICATIONS_PATH = "/membership/applications"
export const VENDOR_HUB_APPLICATIONS_PATH = "/vendor-hub/events"
export const PROGRAMS_FINANCIAL_ASSISTANCE_PATH = "/programs/financial-assistance"

/** Customer portal childcare provider application intake. */
export const CUSTOMER_CHILDCARE_APPLY_PATH = "/customer/apply/childcare"
/** Customer portal volunteer application intake. */
export const CUSTOMER_VOLUNTEER_APPLY_PATH = "/customer/apply/volunteer"

/** @deprecated Sign-Ups applications moved back under People Management */
export const SIGN_UPS_APPLICATIONS_PATH = "/people-management/applications"
/** @deprecated Child Care applications moved back under People Management */
export const CHILD_CARE_APPLICATIONS_PATH = "/people-management/applications"

export type ApplicationsPageTab = "overview" | "submissions" | "templates" | (string & {})
export type PeopleManagementApplicationsPageTab = ApplicationsPageTab

export type HrWorkforceApplicationType =
  | "employment"
  | "volunteer"
  | "childcare_provider"
  | "committee_member"

export function hrCategoryApplicationsPath(
  applicationType?: string | null
): string {
  switch (applicationType) {
    case "employment":
    case "volunteer":
    case "childcare_provider":
      return HR_OVERVIEW_PATH
    case "committee_member":
      return MEMBERSHIP_APPLICATIONS_PATH
    default:
      return HR_OVERVIEW_PATH
  }
}

export function isHrCategoryApplicationsPath(path: string) {
  return (
    path === HR_OVERVIEW_PATH ||
    path === "/workforce/employees" ||
    path === "/workforce/volunteers" ||
    path === "/workforce/childcare" ||
    path === MEMBERSHIP_APPLICATIONS_PATH ||
    path === HR_COMMITTEE_APPLICATIONS_PATH
  )
}

/** HR category Applications tab URL, e.g. /workforce?tab=employees&view=applications */
export function hrCategoryApplicationsUrl(options?: {
  applicationType?: string | null
  status?: ApplicationStatusTabId | ApplicationStatus | ApplicationStatus[]
}) {
  if (options?.applicationType === "committee_member") {
    const params = new URLSearchParams()
    params.set("tab", "applications")
    if (options?.status && options.status !== "all") {
      const value = Array.isArray(options.status) ? options.status.join(",") : options.status
      params.set("status", value)
    }
    return `${MEMBERSHIP_APPLICATIONS_PATH}?${params.toString()}`
  }

  const overviewTab = hrOverviewTabFromApplicationType(options?.applicationType)
  const status =
    options?.status && options.status !== "all"
      ? Array.isArray(options.status)
        ? options.status.join(",")
        : options.status
      : null

  return hrOverviewHref({
    tab: overviewTab,
    view: "applications",
    status,
  })
}

export function applicationsPageUrl(
  basePath: string,
  options?: {
    pageTab?: ApplicationsPageTab
    status?: ApplicationStatusTabId | ApplicationStatus | ApplicationStatus[]
    applicationType?: string
  }
) {
  if (
    basePath === PEOPLE_MANAGEMENT_APPLICATIONS_PATH ||
    basePath === "/people-management/applications" ||
    isHrCategoryApplicationsPath(basePath)
  ) {
    return peopleManagementApplicationsUrl({
      pageTab: options?.pageTab,
      status: options?.status,
      applicationType: options?.applicationType,
    })
  }

  const params = new URLSearchParams()

  const pageTab =
    options?.pageTab ??
    (options?.applicationType || options?.status ? "submissions" : "overview")

  if (pageTab !== "overview") {
    params.set("tab", pageTab)
  }

  if (options?.applicationType) {
    params.set("application_type", options.applicationType)
  }

  if (options?.status && options?.status !== "all") {
    const value = Array.isArray(options.status) ? options.status.join(",") : options.status
    params.set("status", value)
  }

  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

export function vendorApplicationsUrl(options?: {
  pageTab?: ApplicationsPageTab
  status?: ApplicationStatusTabId | ApplicationStatus | ApplicationStatus[]
  applicationType?: string
}) {
  return applicationsPageUrl(VENDOR_HUB_APPLICATIONS_PATH, options)
}

export function programsFinancialAssistanceUrl(options?: {
  pageTab?: ApplicationsPageTab
  status?: ApplicationStatusTabId | ApplicationStatus | ApplicationStatus[]
  applicationType?: string
}) {
  return applicationsPageUrl(PROGRAMS_FINANCIAL_ASSISTANCE_PATH, options)
}

/** Resolves to the matching HR category Applications tab. */
export function peopleManagementApplicationsUrl(options?: {
  pageTab?: ApplicationsPageTab
  status?: ApplicationStatusTabId | ApplicationStatus | ApplicationStatus[]
  applicationType?: string
}) {
  // Legacy templates hub removed.
  if (options?.pageTab === "templates") {
    return HR_OVERVIEW_PATH
  }

  return hrCategoryApplicationsUrl({
    applicationType: options?.applicationType,
    status: options?.status,
  })
}

/** @deprecated Use peopleManagementApplicationsUrl with applicationType volunteer */
export function signUpsApplicationsUrl(options?: {
  pageTab?: ApplicationsPageTab
  status?: ApplicationStatusTabId | ApplicationStatus | ApplicationStatus[]
  applicationType?: string
}) {
  return peopleManagementApplicationsUrl({
    ...options,
    applicationType: options?.applicationType ?? "volunteer",
  })
}

/** @deprecated Use peopleManagementApplicationsUrl with applicationType childcare_provider */
export function childCareApplicationsUrl(options?: {
  pageTab?: ApplicationsPageTab
  status?: ApplicationStatusTabId | ApplicationStatus | ApplicationStatus[]
  applicationType?: string
}) {
  return peopleManagementApplicationsUrl({
    ...options,
    applicationType: options?.applicationType ?? "childcare_provider",
  })
}

export function moduleApplicationsUrl(options: {
  moduleOwner?: ModuleOwner
  applicationType?: string
  pageTab?: ApplicationsPageTab
  status?: ApplicationStatusTabId | ApplicationStatus | ApplicationStatus[]
}) {
  if (isWorkforceModuleOwner(options.moduleOwner) || (!options.moduleOwner && !options.applicationType)) {
    return peopleManagementApplicationsUrl({
      pageTab: options.pageTab,
      status: options.status,
      applicationType: options.applicationType,
    })
  }

  if (options.applicationType === "vendor") {
    return vendorApplicationsUrl({
      pageTab: options.pageTab ?? (options.status ? "submissions" : undefined),
      status: options.status,
      applicationType: options.applicationType,
    })
  }

  if (options.applicationType === "financial_aid") {
    return programsFinancialAssistanceUrl({
      pageTab: options.pageTab ?? (options.status ? "submissions" : undefined),
      status: options.status,
      applicationType: options.applicationType,
    })
  }

  if (
    options.applicationType === "volunteer" ||
    options.applicationType === "childcare_provider" ||
    options.applicationType === "committee_member" ||
    options.applicationType === "employment"
  ) {
    return peopleManagementApplicationsUrl({
      pageTab: options.pageTab,
      status: options.status,
      applicationType: options.applicationType,
    })
  }

  if (options.moduleOwner === "vendor_hub") {
    return vendorApplicationsUrl({
      pageTab: options.pageTab ?? (options.status ? "submissions" : undefined),
      status: options.status,
      applicationType: "vendor",
    })
  }

  if (options.moduleOwner === "programs") {
    return programsFinancialAssistanceUrl({
      pageTab: options.pageTab ?? (options.status ? "submissions" : undefined),
      status: options.status,
      applicationType: "financial_aid",
    })
  }

  const params = new URLSearchParams()
  if (options.applicationType) params.set("application_type", options.applicationType)
  if (options.moduleOwner) params.set("module_owner", options.moduleOwner)
  if (options.status && options.status !== "all") {
    const value = Array.isArray(options.status) ? options.status.join(",") : options.status
    params.set("status", value)
  }

  const query = params.toString()
  return query ? `/applications/all?${query}` : "/applications/all"
}

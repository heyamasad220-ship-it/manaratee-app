import type { ApplicationStatus, ModuleOwner } from "@/lib/applications/application-types"
import type { ApplicationStatusTabId } from "@/lib/applications/application-status-tabs"

export const PEOPLE_MANAGEMENT_APPLICATIONS_PATH = "/people-management/applications"
export const VENDOR_HUB_APPLICATIONS_PATH = "/vendor-hub/applications"
export const PROGRAMS_FINANCIAL_ASSISTANCE_PATH = "/programs/financial-assistance"

export type ApplicationsPageTab = "overview" | "submissions" | "templates"
export type PeopleManagementApplicationsPageTab = ApplicationsPageTab

export function applicationsPageUrl(
  basePath: string,
  options?: {
    pageTab?: ApplicationsPageTab
    status?: ApplicationStatusTabId | ApplicationStatus | ApplicationStatus[]
    applicationType?: string
  }
) {
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

export function peopleManagementApplicationsUrl(options?: {
  pageTab?: ApplicationsPageTab
  status?: ApplicationStatusTabId | ApplicationStatus | ApplicationStatus[]
  applicationType?: string
}) {
  return applicationsPageUrl(PEOPLE_MANAGEMENT_APPLICATIONS_PATH, options)
}

export function moduleApplicationsUrl(options: {
  moduleOwner?: ModuleOwner
  applicationType?: string
  pageTab?: ApplicationsPageTab
  status?: ApplicationStatusTabId | ApplicationStatus | ApplicationStatus[]
}) {
  if (options.moduleOwner === "hr" || (!options.moduleOwner && !options.applicationType)) {
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

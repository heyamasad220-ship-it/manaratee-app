import type { ApplicationStatus, ModuleOwner } from "@/lib/applications/application-types"
import type { ApplicationStatusTabId } from "@/lib/applications/application-status-tabs"

export const PEOPLE_MANAGEMENT_APPLICATIONS_PATH = "/people-management/applications"

export type PeopleManagementApplicationsPageTab = "overview" | "submissions" | "templates"

export function peopleManagementApplicationsUrl(options?: {
  pageTab?: PeopleManagementApplicationsPageTab
  status?: ApplicationStatusTabId | ApplicationStatus | ApplicationStatus[]
  applicationType?: string
}) {
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
  return query ? `${PEOPLE_MANAGEMENT_APPLICATIONS_PATH}?${query}` : PEOPLE_MANAGEMENT_APPLICATIONS_PATH
}

export function moduleApplicationsUrl(options: {
  moduleOwner?: ModuleOwner
  applicationType?: string
  status?: ApplicationStatusTabId | ApplicationStatus | ApplicationStatus[]
}) {
  if (options.moduleOwner === "hr" || (!options.moduleOwner && !options.applicationType)) {
    return peopleManagementApplicationsUrl({
      status: options.status,
      applicationType: options.applicationType,
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

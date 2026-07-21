import { DONATIONS_GROUP_GIVING_REPORT_PATH } from "@/lib/donations/donor-giving-report"
import { isSafeReturnToPath, RETURN_TO_QUERY_PARAM } from "@/lib/navigation/return-to"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"

export const DONATIONS_GROUPS_BASE_PATH = "/donations/groups"

export type GroupWorkspaceTab =
  | "overview"
  | "employees"
  | "rosters"
  | "offerings"
  | "schedule"
  | "payroll"
  | "expenses"
  | "budget"
  | "group-giving"
  | "activity"
  | "reports"

export function donationGroupHref(
  groupContactId: string,
  options?: {
    tab?: "members" | "financial" | "activity" | "group-giving"
    returnTo?: string
  }
): string {
  const params = new URLSearchParams()
  const tab = options?.tab === "group-giving" ? "financial" : options?.tab
  if (tab && tab !== "members") {
    params.set("tab", tab)
  }
  if (options?.returnTo && isSafeReturnToPath(options.returnTo)) {
    params.set(RETURN_TO_QUERY_PARAM, options.returnTo)
  }
  const query = params.toString()
  return query
    ? `${DONATIONS_GROUPS_BASE_PATH}/${groupContactId}?${query}`
    : `${DONATIONS_GROUPS_BASE_PATH}/${groupContactId}`
}

/** Canonical workspace URL when a giving group is paired with a Department. */
export function departmentGroupWorkspaceHref(
  departmentId: string,
  options?: {
    tab?: GroupWorkspaceTab
    returnTo?: string
  }
): string {
  const params = new URLSearchParams()
  if (options?.tab && options.tab !== "overview") {
    params.set("tab", options.tab)
  }
  if (options?.returnTo && isSafeReturnToPath(options.returnTo)) {
    params.set(RETURN_TO_QUERY_PARAM, options.returnTo)
  }
  const query = params.toString()
  const base = workforceDepartmentDetailPath(departmentId)
  return query ? `${base}?${query}` : base
}

export function mapDonationTabToWorkspaceTab(
  tab: string | null | undefined
): GroupWorkspaceTab {
  if (
    tab === "overview" ||
    tab === "employees" ||
    tab === "rosters" ||
    tab === "offerings" ||
    tab === "schedule" ||
    tab === "payroll" ||
    tab === "expenses" ||
    tab === "budget" ||
    tab === "activity" ||
    tab === "reports"
  ) {
    return tab
  }
  // Legacy Students / Tuition Transactions / participants → Rosters.
  if (tab === "payments" || tab === "participants") {
    return "rosters"
  }
  // Donation Members / Financial map to department Group giving.
  if (tab === "members" || tab === "financial" || tab === "group-giving") {
    return "group-giving"
  }
  // Legacy Babysitting tab removed — childcare pay is on Payroll.
  if (tab === "babysitting") {
    return "payroll"
  }
  return "overview"
}

export function parseDepartmentWorkspaceTab(
  tab: string | null | undefined
): GroupWorkspaceTab {
  if (
    tab === "overview" ||
    tab === "employees" ||
    tab === "rosters" ||
    tab === "offerings" ||
    tab === "schedule" ||
    tab === "payroll" ||
    tab === "expenses" ||
    tab === "budget" ||
    tab === "group-giving" ||
    tab === "activity" ||
    tab === "reports"
  ) {
    return tab
  }
  // Legacy Students / Tuition Transactions / participants → Rosters.
  if (tab === "payments" || tab === "participants") {
    return "rosters"
  }
  // Legacy Financial / Members → Group giving.
  if (tab === "financial" || tab === "members") {
    return "group-giving"
  }
  // Legacy Babysitting → Payroll (childcare providers).
  if (tab === "babysitting") {
    return "payroll"
  }
  return "overview"
}

export function donationGroupGivingListHref(returnTo?: string) {
  if (returnTo && isSafeReturnToPath(returnTo)) {
    return returnTo
  }
  return DONATIONS_GROUP_GIVING_REPORT_PATH
}

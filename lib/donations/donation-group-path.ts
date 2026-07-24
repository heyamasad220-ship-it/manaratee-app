import { DONATIONS_GROUP_GIVING_REPORT_PATH } from "@/lib/donations/donor-giving-report"
import { isSafeReturnToPath, RETURN_TO_QUERY_PARAM } from "@/lib/navigation/return-to"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"

export const DONATIONS_GROUPS_BASE_PATH = "/donations/groups"

export type GroupWorkspaceTab =
  | "overview"
  | "employees"
  | "rosters"
  | "applications"
  | "schedule"
  | "financial"
  | "group-giving"
  | "activity"
  | "reports"

/** Sub-tabs under Department → Financial. */
export type DepartmentFinanceSection = "payroll" | "expenses" | "budget"

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
    finance?: DepartmentFinanceSection
    returnTo?: string
  }
): string {
  const params = new URLSearchParams()
  if (options?.tab && options.tab !== "overview") {
    params.set("tab", options.tab)
  }
  if (
    options?.tab === "financial" &&
    options.finance &&
    options.finance !== "payroll"
  ) {
    params.set("section", options.finance)
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
    tab === "applications" ||
    tab === "schedule" ||
    tab === "activity" ||
    tab === "reports"
  ) {
    return tab
  }
  // Legacy Years/Seasons catalog tab → Overview (years live there now).
  if (tab === "offerings") {
    return "overview"
  }
  // Legacy top-level finance tabs → Financial parent.
  if (
    tab === "payroll" ||
    tab === "expenses" ||
    tab === "budget" ||
    tab === "babysitting"
  ) {
    return "financial"
  }
  // Legacy Students / Tuition Transactions / participants → Rosters.
  if (tab === "payments" || tab === "participants") {
    return "rosters"
  }
  // Donation Members / Financial map to department Group giving.
  if (tab === "members" || tab === "financial" || tab === "group-giving") {
    return "group-giving"
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
    tab === "applications" ||
    tab === "schedule" ||
    tab === "financial" ||
    tab === "group-giving" ||
    tab === "activity" ||
    tab === "reports"
  ) {
    return tab
  }
  // Legacy Years/Seasons catalog tab → Overview.
  if (tab === "offerings") {
    return "overview"
  }
  // Legacy top-level Payroll / Expenses / Financial Summary → Financial.
  if (
    tab === "payroll" ||
    tab === "expenses" ||
    tab === "budget" ||
    tab === "babysitting"
  ) {
    return "financial"
  }
  // Legacy Students / Tuition Transactions / participants → Rosters.
  if (tab === "payments" || tab === "participants") {
    return "rosters"
  }
  // Legacy Members → Group giving (donation “financial” stays group-giving via mapDonation).
  if (tab === "members") {
    return "group-giving"
  }
  return "overview"
}

export function parseDepartmentFinanceSection(
  tab: string | null | undefined,
  section: string | null | undefined
): DepartmentFinanceSection {
  if (tab === "expenses") return "expenses"
  if (tab === "budget") return "budget"
  if (tab === "payroll" || tab === "babysitting") return "payroll"
  if (section === "expenses") return "expenses"
  if (section === "budget") return "budget"
  return "payroll"
}

export function donationGroupGivingListHref(returnTo?: string) {
  if (returnTo && isSafeReturnToPath(returnTo)) {
    return returnTo
  }
  return DONATIONS_GROUP_GIVING_REPORT_PATH
}

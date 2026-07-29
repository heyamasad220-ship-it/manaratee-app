import { DONATIONS_GROUP_GIVING_REPORT_PATH } from "@/lib/donations/donor-giving-report"
import { isSafeReturnToPath, RETURN_TO_QUERY_PARAM } from "@/lib/navigation/return-to"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"

export const DONATIONS_GROUPS_BASE_PATH = "/donations/groups"

export type GroupWorkspaceTab =
  | "overview"
  | "programs"
  | "students"
  | "schedule"
  | "financial"
  | "group-giving"
  | "activity"
  | "settings"

/** Sub-tabs under Department → Financial. */
export type DepartmentFinanceSection = "payroll" | "expenses" | "budget"

/** Stage filters under Department → Students. */
export type DepartmentStudentsSection = "review" | "approved" | "roster"

/** Sub-tabs under Department → Settings. */
export type DepartmentSettingsSection =
  | "general"
  | "registration"
  | "notifications"
  | "promo-codes"
  | "service-needs"
  | "year-defaults"

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
    studentsSection?: DepartmentStudentsSection
    settingsSection?: DepartmentSettingsSection
    /** Prefill Programs year/season filter (open program id). */
    yearProgramId?: string
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
  if (
    options?.tab === "students" &&
    options.studentsSection &&
    options.studentsSection !== "roster"
  ) {
    params.set("section", options.studentsSection)
  }
  if (
    options?.tab === "settings" &&
    options.settingsSection &&
    options.settingsSection !== "general"
  ) {
    params.set("section", options.settingsSection)
  }
  if (options?.yearProgramId) {
    params.set("year", options.yearProgramId)
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
    tab === "programs" ||
    tab === "students" ||
    tab === "schedule" ||
    tab === "activity" ||
    tab === "settings"
  ) {
    return tab
  }
  // Legacy Archive / Reports tab removed — fall through to Overview.
  if (tab === "reports") {
    return "overview"
  }
  // Legacy Employees tab → Financial / Payroll.
  if (tab === "employees") {
    return "financial"
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
  // Students hub (merged Enrollments + Applications).
  if (
    tab === "rosters" ||
    tab === "enrollments" ||
    tab === "payments" ||
    tab === "participants" ||
    tab === "applications"
  ) {
    return "students"
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
    tab === "programs" ||
    tab === "students" ||
    tab === "schedule" ||
    tab === "financial" ||
    tab === "group-giving" ||
    tab === "activity" ||
    tab === "settings"
  ) {
    return tab
  }
  // Legacy Archive / Reports tab removed.
  if (tab === "reports") {
    return "overview"
  }
  // Legacy Employees tab → Financial / Payroll.
  if (tab === "employees") {
    return "financial"
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
  // Students hub (merged Enrollments + Applications).
  if (
    tab === "rosters" ||
    tab === "enrollments" ||
    tab === "payments" ||
    tab === "participants" ||
    tab === "applications"
  ) {
    return "students"
  }
  // Legacy Members → Group giving (donation “financial” stays group-giving via mapDonation).
  if (tab === "members") {
    return "group-giving"
  }
  return "overview"
}

/**
 * Students stage from URL. Returns null when the caller should auto-pick
 * (needs review if any pending, otherwise roster).
 */
export function parseDepartmentStudentsSection(
  tab: string | null | undefined,
  section: string | null | undefined
): DepartmentStudentsSection | null {
  if (tab === "applications") return "review"
  if (
    tab === "rosters" ||
    tab === "enrollments" ||
    tab === "payments" ||
    tab === "participants"
  ) {
    return "roster"
  }
  if (tab !== "students") return null
  if (
    section === "review" ||
    section === "approved" ||
    section === "roster"
  ) {
    return section
  }
  return null
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

export function parseDepartmentSettingsSection(
  section: string | null | undefined
): DepartmentSettingsSection {
  if (
    section === "registration" ||
    section === "notifications" ||
    section === "promo-codes" ||
    section === "service-needs" ||
    section === "year-defaults"
  ) {
    return section
  }
  return "general"
}

export function donationGroupGivingListHref(returnTo?: string) {
  if (returnTo && isSafeReturnToPath(returnTo)) {
    return returnTo
  }
  return DONATIONS_GROUP_GIVING_REPORT_PATH
}

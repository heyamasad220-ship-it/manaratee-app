import { DONATIONS_GROUP_GIVING_REPORT_PATH } from "@/lib/donations/donor-giving-report"
import { isSafeReturnToPath, RETURN_TO_QUERY_PARAM } from "@/lib/navigation/return-to"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"

export const DONATIONS_GROUPS_BASE_PATH = "/donations/groups"

export type GroupWorkspaceTab =
  | "overview"
  | "programs"
  | "students"
  | "schedule"
  | "employees"
  | "financial"
  | "group-giving"
  | "activity"
  | "settings"

/**
 * Year/program workspace tabs (shown when `?year=` is set).
 * Dual-purpose tabs:
 * - `overview` with `?year=` → Program dashboard; without → department Overview
 * - `programs` with `?year=` → Offerings; without → department Programs catalog
 * - `settings` with `?year=` → Program settings; without → department Settings
 */
export const DEPARTMENT_YEAR_WORKSPACE_TABS = [
  "overview",
  "programs",
  "students",
  "settings",
] as const satisfies readonly GroupWorkspaceTab[]

/** Year tabs that must not load without `?year=` (redirect to department Overview). */
export const DEPARTMENT_YEAR_REQUIRED_TABS = [
  "students",
] as const satisfies readonly GroupWorkspaceTab[]

/** Tabs that belong to the department itself (no year required). */
export const DEPARTMENT_LEVEL_WORKSPACE_TABS = [
  "overview",
  "programs",
  "activity",
  "employees",
  "group-giving",
  "financial",
  "settings",
] as const satisfies readonly GroupWorkspaceTab[]

export function isDepartmentYearWorkspaceTab(
  tab: GroupWorkspaceTab
): tab is (typeof DEPARTMENT_YEAR_WORKSPACE_TABS)[number] {
  return (DEPARTMENT_YEAR_WORKSPACE_TABS as readonly string[]).includes(tab)
}

export function isDepartmentYearRequiredTab(
  tab: GroupWorkspaceTab
): tab is (typeof DEPARTMENT_YEAR_REQUIRED_TABS)[number] {
  return (DEPARTMENT_YEAR_REQUIRED_TABS as readonly string[]).includes(tab)
}

export function isDepartmentLevelWorkspaceTab(
  tab: GroupWorkspaceTab
): tab is (typeof DEPARTMENT_LEVEL_WORKSPACE_TABS)[number] {
  return (DEPARTMENT_LEVEL_WORKSPACE_TABS as readonly string[]).includes(tab)
}

/** Sub-tabs under Department → Financial. `employees` is leftover (`?tab=financial&section=employees`). */
export type DepartmentFinanceSection =
  | "employees"
  | "payroll"
  | "expenses"
  | "budget"

/** Stage filters under Department → Students / Program → Registrations. */
export type DepartmentStudentsSection = "applications" | "enrollments"

/** Sub-tabs under Program Workspace → Schedule. */
export type DepartmentScheduleSection = "class-times" | "activity-planner"

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
  const tab =
    options?.tab === "financial" && options.finance === "employees"
      ? "employees"
      : options?.tab
  if (tab && tab !== "overview") {
    params.set("tab", tab)
  }
  if (
    tab === "financial" &&
    options?.finance &&
    options.finance !== "employees" &&
    options.finance !== "payroll"
  ) {
    params.set("section", options.finance)
  }
  if (
    options?.tab === "students" &&
    options.studentsSection &&
    options.studentsSection !== "enrollments"
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
    tab === "activity" ||
    tab === "settings"
  ) {
    return tab
  }
  // Retired department Schedule tab — lives on Program Workspace.
  if (tab === "schedule") {
    return "programs"
  }
  // Retired department Reports tab — same content as Financial.
  if (tab === "reports") {
    return "financial"
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
    tab === "employees" ||
    tab === "financial" ||
    tab === "group-giving" ||
    tab === "activity" ||
    tab === "settings"
  ) {
    return tab
  }
  // Retired department Schedule tab — lives on Program Workspace.
  if (tab === "schedule") {
    return "programs"
  }
  // Retired department Reports tab — same content as Financial.
  if (tab === "reports") {
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
  if (tab === "applications") return "applications"
  if (
    tab === "rosters" ||
    tab === "enrollments" ||
    tab === "payments" ||
    tab === "participants"
  ) {
    return "enrollments"
  }
  if (tab !== "students") return null
  if (
    section === "review" ||
    section === "approved" ||
    section === "applications"
  ) {
    return "applications"
  }
  if (section === "roster" || section === "enrollments") {
    return "enrollments"
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
  if (tab !== "financial") return "payroll"
  if (section === "expenses") return "expenses"
  if (section === "budget") return "budget"
  if (section === "payroll") return "payroll"
  if (section === "employees") return "employees"
  return "payroll"
}

export function parseDepartmentScheduleSection(
  tab: string | null | undefined,
  section: string | null | undefined
): DepartmentScheduleSection {
  if (tab !== "schedule") return "class-times"
  if (section === "activity-planner") return "activity-planner"
  return "class-times"
}

export const MOVED_DEPARTMENT_SETTINGS_SECTIONS = [
  "year-defaults",
  "registration",
  "notifications",
  "promo-codes",
  "service-needs",
] as const

export function isMovedDepartmentSettingsSection(
  section: string | null | undefined
): boolean {
  return (MOVED_DEPARTMENT_SETTINGS_SECTIONS as readonly string[]).includes(
    section ?? ""
  )
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

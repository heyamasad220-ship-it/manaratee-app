import { FINANCE_PAYROLL_PATH } from "@/lib/finance/finance-paths"

export const HR_OVERVIEW_PATH = "/workforce"
export const HR_DEPARTMENTS_PATH = "/workforce/departments"
export const HR_EMPLOYEES_PATH = "/workforce/employees"
export const HR_VOLUNTEERS_PATH = "/workforce/volunteers"
export const HR_CHILDCARE_PATH = "/workforce/childcare"

export type HrOverviewTab =
  | "departments"
  | "employees"
  | "volunteers"
  | "childcare"

export type HrDirectoryView = "roster" | "applications" | "positions"

export const HR_OVERVIEW_TABS: ReadonlyArray<{
  id: HrOverviewTab
  label: string
}> = [
  { id: "employees", label: "Employees" },
  { id: "volunteers", label: "Volunteers" },
  { id: "childcare", label: "Childcare Providers" },
]

export function hrOverviewTabPath(tab: HrOverviewTab = "employees"): string {
  switch (tab) {
    case "departments":
      return HR_DEPARTMENTS_PATH
    case "volunteers":
      return HR_VOLUNTEERS_PATH
    case "childcare":
      return HR_CHILDCARE_PATH
    case "employees":
    default:
      return HR_EMPLOYEES_PATH
  }
}

/** Resolve HR section from a pathname (path-based routes). */
export function hrOverviewTabFromPathname(
  pathname: string | null | undefined
): HrOverviewTab {
  if (!pathname) return "employees"
  if (
    pathname === HR_DEPARTMENTS_PATH ||
    pathname.startsWith(`${HR_DEPARTMENTS_PATH}/`)
  ) {
    return "departments"
  }
  if (
    pathname === HR_VOLUNTEERS_PATH ||
    pathname.startsWith(`${HR_VOLUNTEERS_PATH}/`)
  ) {
    return "volunteers"
  }
  if (
    pathname === HR_CHILDCARE_PATH ||
    pathname.startsWith(`${HR_CHILDCARE_PATH}/`)
  ) {
    return "childcare"
  }
  return "employees"
}

/** Canonical URL for employee job-title management. */
export function hrEmployeePositionsHref() {
  return hrOverviewHref({ tab: "employees", view: "positions" })
}

/** Canonical URL for org payroll queue (Finance → Payroll). */
export function hrPayrollHref() {
  return FINANCE_PAYROLL_PATH
}

export function parseHrOverviewTab(tab: string | null | undefined): HrOverviewTab {
  if (
    tab === "departments" ||
    tab === "employees" ||
    tab === "volunteers" ||
    tab === "childcare"
  ) {
    return tab
  }
  // Legacy `overview` (and unknown) → Employees.
  return "employees"
}

export function parseHrDirectoryView(
  searchParams: { get: (key: string) => string | null },
  options?: { legacyTabParam?: boolean }
): HrDirectoryView {
  const view = searchParams.get("view")
  // Legacy Archived tab removed — use Active/Inactive status filter instead.
  if (view === "archived") {
    return "roster"
  }
  if (view === "applications" || view === "positions") {
    return view
  }
  if (options?.legacyTabParam !== false) {
    const tab = searchParams.get("tab")
    if (tab === "archived") {
      return "roster"
    }
    if (tab === "applications" || tab === "positions") {
      return tab
    }
  }
  return "roster"
}

export function hrOverviewHref(options?: {
  tab?: HrOverviewTab
  view?: Exclude<HrDirectoryView, "roster"> | null
  status?: string | null
}): string {
  const params = new URLSearchParams()
  const tab = options?.tab ?? "employees"
  const path = hrOverviewTabPath(tab)
  if (options?.view === "applications" || options?.view === "positions") {
    params.set("view", options.view)
  }
  if (options?.status && options.status !== "all") {
    params.set("status", options.status)
  }
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

export function hrOverviewTabFromApplicationType(
  applicationType?: string | null
): "employees" | "volunteers" | "childcare" {
  switch (applicationType) {
    case "volunteer":
      return "volunteers"
    case "childcare_provider":
      return "childcare"
    default:
      return "employees"
  }
}

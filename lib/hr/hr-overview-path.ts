export const HR_OVERVIEW_PATH = "/workforce"

export type HrOverviewTab =
  | "overview"
  | "departments"
  | "employees"
  | "volunteers"
  | "childcare"
  | "payroll"

export type HrDirectoryView = "roster" | "applications" | "positions"

export const HR_OVERVIEW_TABS: ReadonlyArray<{
  id: HrOverviewTab
  label: string
}> = [
  { id: "overview", label: "Overview" },
  { id: "departments", label: "Departments" },
  { id: "employees", label: "Employees" },
  { id: "volunteers", label: "Volunteers" },
  { id: "childcare", label: "Childcare Providers" },
  { id: "payroll", label: "Payroll" },
]

/** Canonical URL for employee job-title management. */
export function hrEmployeePositionsHref() {
  return hrOverviewHref({ tab: "employees", view: "positions" })
}

/** Canonical URL for org payroll queue (formerly /finance/payroll). */
export function hrPayrollHref() {
  return hrOverviewHref({ tab: "payroll" })
}

export function parseHrOverviewTab(tab: string | null | undefined): HrOverviewTab {
  if (
    tab === "departments" ||
    tab === "employees" ||
    tab === "volunteers" ||
    tab === "childcare" ||
    tab === "payroll"
  ) {
    return tab
  }
  return "overview"
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
  const tab = options?.tab ?? "overview"
  if (tab !== "overview") {
    params.set("tab", tab)
  }
  if (options?.view === "applications" || options?.view === "positions") {
    params.set("view", options.view)
  }
  if (options?.status && options.status !== "all") {
    params.set("status", options.status)
  }
  const query = params.toString()
  return query ? `${HR_OVERVIEW_PATH}?${query}` : HR_OVERVIEW_PATH
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

export const PROGRAMS_OVERVIEW_PATH = "/programs"
export const PROGRAMS_LIST_PATH = "/programs/list"
export const PROGRAMS_OFFERINGS_PATH = "/programs/catalog"
export const PROGRAMS_REGISTRATIONS_PATH = "/programs/registrations"
export const PROGRAMS_FINANCE_PATH = "/finance/transactions"
export const PROGRAMS_FINANCE_PAYROLL_PATH = "/finance/payroll"
export const PROGRAMS_FINANCIAL_ASSISTANCE_PATH =
  "/finance/financial-assistance"
export const PROGRAMS_REPORTS_PATH = "/programs/reports/enrollments"

export type ProgramsModuleTabId =
  | "overview"
  | "programs"
  | "offerings"
  | "registrations"
  | "finance"
  | "financial-assistance"
  | "reports"

export type ProgramsModuleTab = {
  id: ProgramsModuleTabId
  label: string
  href: string
}

export const PROGRAMS_MODULE_TABS: ProgramsModuleTab[] = [
  { id: "overview", label: "Overview", href: PROGRAMS_OVERVIEW_PATH },
  { id: "programs", label: "Programs", href: PROGRAMS_LIST_PATH },
  { id: "offerings", label: "Offerings", href: PROGRAMS_OFFERINGS_PATH },
  {
    id: "registrations",
    label: "Registrations",
    href: PROGRAMS_REGISTRATIONS_PATH,
  },
  { id: "finance", label: "Finance", href: PROGRAMS_FINANCE_PATH },
  {
    id: "financial-assistance",
    label: "Financial Assistance",
    href: PROGRAMS_FINANCIAL_ASSISTANCE_PATH,
  },
  { id: "reports", label: "Reports", href: PROGRAMS_REPORTS_PATH },
]

function pathStarts(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function resolveProgramsModuleTab(
  pathname: string
): ProgramsModuleTabId | null {
  const path = pathname.split("?")[0] || pathname
  if (
    pathStarts(path, PROGRAMS_FINANCIAL_ASSISTANCE_PATH) ||
    pathStarts(path, "/programs/financial-assistance")
  ) {
    return "financial-assistance"
  }
  if (
    pathStarts(path, PROGRAMS_FINANCE_PATH) ||
    pathStarts(path, PROGRAMS_FINANCE_PAYROLL_PATH)
  ) {
    return "finance"
  }
  if (pathStarts(path, PROGRAMS_REGISTRATIONS_PATH)) {
    return "registrations"
  }
  if (pathStarts(path, "/programs/reports")) {
    return "reports"
  }
  if (pathStarts(path, PROGRAMS_OFFERINGS_PATH)) {
    return "offerings"
  }
  if (pathStarts(path, PROGRAMS_LIST_PATH)) {
    return "programs"
  }
  const programWorkspaceMatch =
    /^\/programs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/(.*))?$/i.exec(
      path
    )
  if (programWorkspaceMatch) {
    const rest = programWorkspaceMatch[1] || ""
    if (rest === "offerings" || rest.startsWith("offerings/")) {
      return "offerings"
    }
    return "programs"
  }
  if (path === PROGRAMS_OVERVIEW_PATH) {
    return "overview"
  }
  return null
}

import { MASTER_CALENDAR_LABEL } from "@/lib/events/facility-event-request-href"
import { WORKFORCE_DEPARTMENTS_PATH } from "@/lib/departments/department-paths"

export const DEPARTMENTS_MASTER_CALENDAR_PATH = `${WORKFORCE_DEPARTMENTS_PATH}/calendar`

export type DepartmentsSectionTabId = "departments" | "calendar"

export type DepartmentsSectionTab = {
  id: DepartmentsSectionTabId
  label: string
  href: string
}

export const DEPARTMENTS_SECTION_TABS: DepartmentsSectionTab[] = [
  {
    id: "departments",
    label: "Departments",
    href: WORKFORCE_DEPARTMENTS_PATH,
  },
  {
    id: "calendar",
    label: MASTER_CALENDAR_LABEL,
    href: DEPARTMENTS_MASTER_CALENDAR_PATH,
  },
]

export function resolveDepartmentsSectionTab(
  pathname: string
): DepartmentsSectionTabId {
  if (
    pathname === DEPARTMENTS_MASTER_CALENDAR_PATH ||
    pathname.startsWith(`${DEPARTMENTS_MASTER_CALENDAR_PATH}/`)
  ) {
    return "calendar"
  }
  return "departments"
}

export function departmentsMasterCalendarHref(options?: {
  month?: string | null
  departmentId?: string | null
  returnTo?: string | null
}) {
  const params = new URLSearchParams()
  if (options?.month) params.set("month", options.month)
  if (options?.departmentId) params.set("department", options.departmentId)
  if (options?.returnTo) params.set("returnTo", options.returnTo)
  const query = params.toString()
  return query
    ? `${DEPARTMENTS_MASTER_CALENDAR_PATH}?${query}`
    : DEPARTMENTS_MASTER_CALENDAR_PATH
}

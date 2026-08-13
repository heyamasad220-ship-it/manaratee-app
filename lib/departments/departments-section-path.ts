import { WORKFORCE_DEPARTMENTS_PATH } from "@/lib/departments/department-paths"
import { eventManagementMasterCalendarHref } from "@/lib/events/event-management-section-path"

/** @deprecated Master Calendar moved to Events — use eventManagementMasterCalendarHref. */
export const DEPARTMENTS_MASTER_CALENDAR_PATH = `${WORKFORCE_DEPARTMENTS_PATH}/calendar`

/**
 * @deprecated Prefer eventManagementMasterCalendarHref — kept so legacy callers
 * and the Departments calendar redirect keep working.
 */
export function departmentsMasterCalendarHref(options?: {
  month?: string | null
  departmentId?: string | null
  returnTo?: string | null
}) {
  return eventManagementMasterCalendarHref(options)
}

import { Suspense } from "react"

import { Header } from "@/components/layout/header"
import { DepartmentsSectionNav } from "@/components/departments/departments-section-nav"
import { InternalEventsCalendarClient } from "@/components/events/internal-events-calendar-client"
import { getDepartments } from "@/lib/departments/department-queries"
import { getInternalEventsForCalendar } from "@/lib/events/internal-event-calendar-queries"
import { isSafeReturnToPath } from "@/lib/navigation/return-to"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

function parseMonthParam(value: string | undefined) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    return value
  }
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  return `${now.getFullYear()}-${month}`
}

function monthRangeIso(monthParam: string) {
  const [yearText, monthText] = monthParam.split("-")
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  const rangeStart = new Date(year, monthIndex, 1)
  const rangeEnd = new Date(year, monthIndex + 1, 1)
  return {
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
  }
}

export default async function DepartmentsMasterCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string
    department?: string
    returnTo?: string
  }>
}) {
  await requireAnyPermission(
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_VIEW,
    PERMISSIONS.PROGRAMS_MANAGE,
    PERMISSIONS.STAFF_VIEW
  )

  const params = await searchParams
  const month = parseMonthParam(params.month)
  const departmentId = params.department?.trim() || null
  const returnTo = isSafeReturnToPath(params.returnTo) ? params.returnTo : null
  const { rangeStart, rangeEnd } = monthRangeIso(month)

  const [events, departments, canBookSpace] = await Promise.all([
    getInternalEventsForCalendar({
      rangeStart,
      rangeEnd,
      departmentId,
    }),
    getDepartments(),
    hasAnyPermission(
      PERMISSIONS.EVENTS_VIEW,
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_VIEW,
      PERMISSIONS.PROGRAMS_MANAGE
    ),
  ])

  const departmentExists = departments.some(
    (department) => department.id === departmentId
  )

  return (
    <>
      <Header title="Departments" />
      <Suspense fallback={null}>
        <DepartmentsSectionNav />
      </Suspense>
      <InternalEventsCalendarClient
        events={events}
        departments={departments.map((department) => ({
          id: department.id,
          name: department.name,
        }))}
        initialMonth={month}
        initialDepartmentId={departmentExists ? departmentId : null}
        canBookSpace={canBookSpace}
        returnTo={returnTo}
        hideHeader
      />
    </>
  )
}

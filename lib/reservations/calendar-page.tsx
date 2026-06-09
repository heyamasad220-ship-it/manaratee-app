import { Suspense } from "react"

import { ReservationCalendar } from "@/components/reservations/reservation-calendar"
import { getCalendarData } from "@/lib/reservations/reservation-queries"
import {
  parseCalendarDate,
  toDateParam,
} from "@/lib/reservations/reservation-time"
import type { CalendarContext, CalendarViewMode } from "@/lib/reservations/reservation-types"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
  type PermissionKey,
} from "@/lib/permissions/permissions"

function getSearchParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string
) {
  const value = params?.[key]
  return Array.isArray(value) ? value[0] : value
}

async function CalendarPageContent({
  context,
  searchParams,
  permissions,
  headerTitle,
}: {
  context: CalendarContext
  searchParams?: Promise<Record<string, string | string[] | undefined>>
  permissions: PermissionKey[]
  headerTitle?: string
}) {
  await requireAnyPermission(...permissions)

  const resolved = await searchParams
  const dateParam = getSearchParam(resolved, "date")
  const viewParam = getSearchParam(resolved, "view")
  const anchorDate = parseCalendarDate(dateParam)
  const view: CalendarViewMode = viewParam === "day" ? "day" : "week"

  const [data, canManageBlocks] = await Promise.all([
    getCalendarData(context, anchorDate, view),
    hasAnyPermission(
      PERMISSIONS.BOOKINGS_MANAGE,
      PERMISSIONS.SPACES_MANAGE,
      PERMISSIONS.EVENTS_MANAGE
    ),
  ])

  return (
    <ReservationCalendar
      context={context}
      initialData={data}
      initialDate={dateParam || toDateParam(anchorDate)}
      initialView={view}
      canManageBlocks={canManageBlocks}
      headerTitle={headerTitle}
      enableOperationalBrief={context === "facilities"}
    />
  )
}

export function createCalendarPage(
  context: CalendarContext,
  permissions: PermissionKey[],
  headerTitle?: string
) {
  return function CalendarPage({
    searchParams,
  }: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
  }) {
    return (
      <Suspense fallback={null}>
        <CalendarPageContent
          context={context}
          searchParams={searchParams}
          permissions={permissions}
          headerTitle={headerTitle}
        />
      </Suspense>
    )
  }
}

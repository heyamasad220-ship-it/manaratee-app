import { Suspense } from "react"

import { ReservationCalendar } from "@/components/reservations/reservation-calendar"
import type { CalendarAudience } from "@/lib/reservations/calendar-audience"
import {
  CALENDAR_AUDIENCE_DESCRIPTIONS,
  CALENDAR_AUDIENCE_LABELS,
} from "@/lib/reservations/calendar-audience"
import { getCalendarData } from "@/lib/reservations/reservation-queries"
import {
  parseCalendarDate,
  toDateParam,
} from "@/lib/reservations/reservation-time"
import type { CalendarViewMode } from "@/lib/reservations/reservation-types"
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

async function AudienceCalendarPageContent({
  audience,
  searchParams,
  permissions,
  headerTitle,
}: {
  audience: CalendarAudience
  searchParams?: Promise<Record<string, string | string[] | undefined>>
  permissions: PermissionKey[]
  headerTitle?: string
}) {
  await requireAnyPermission(...permissions)

  const resolved = await searchParams
  const dateParam = getSearchParam(resolved, "date")
  const anchorDate = parseCalendarDate(dateParam)
  const viewParam = getSearchParam(resolved, "view")
  const view: CalendarViewMode =
    viewParam === "grid" || viewParam === "week" ? "grid" : "day"

  const [data, canManageBlocks, canPlanEvents] = await Promise.all([
    getCalendarData(audience, anchorDate, view),
    hasAnyPermission(
      PERMISSIONS.BOOKINGS_MANAGE,
      PERMISSIONS.SPACES_MANAGE,
      PERMISSIONS.EVENTS_MANAGE
    ),
    hasAnyPermission(
      PERMISSIONS.EVENTS_VIEW,
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_VIEW,
      PERMISSIONS.PROGRAMS_MANAGE
    ),
  ])

  return (
    <ReservationCalendar
      audience={audience}
      initialData={data}
      initialDate={dateParam || toDateParam(anchorDate)}
      initialView={view}
      canManageBlocks={canManageBlocks && audience === "ops"}
      canPlanEvents={
        canPlanEvents && (audience === "staff" || audience === "ops")
      }
      headerTitle={headerTitle || CALENDAR_AUDIENCE_LABELS[audience]}
      description={CALENDAR_AUDIENCE_DESCRIPTIONS[audience]}
    />
  )
}

export function createAudienceCalendarPage(
  audience: CalendarAudience,
  permissions: PermissionKey[],
  headerTitle?: string
) {
  return function AudienceCalendarPage({
    searchParams,
  }: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
  }) {
    return (
      <Suspense fallback={null}>
        <AudienceCalendarPageContent
          audience={audience}
          searchParams={searchParams}
          permissions={permissions}
          headerTitle={headerTitle}
        />
      </Suspense>
    )
  }
}

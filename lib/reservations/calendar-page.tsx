import { Suspense } from "react"

import { ReservationCalendar } from "@/components/reservations/reservation-calendar"
import type { FacilityEventFormOptions } from "@/components/reservations/reservation-calendar"
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
import {
  RESERVATION_SOURCE_TYPES,
  type CalendarViewMode,
  type ReservationSourceType,
} from "@/lib/reservations/reservation-types"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
  type PermissionKey,
} from "@/lib/permissions/permissions"
import { getDepartments } from "@/lib/departments/department-queries"
import { getEventTypes } from "@/lib/events/event-type-queries"
import { getInternalEventFormDefaults } from "@/lib/events/internal-event-form-defaults"
import { getActiveCalendarVenues } from "@/lib/bookings/venue-calendar-venues"
import { getRoomSetupStyles } from "@/lib/setup-styles/setup-style-queries"

const VALID_SOURCE_TYPES = new Set<string>(
  Object.values(RESERVATION_SOURCE_TYPES)
)

function getSearchParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string
) {
  const value = params?.[key]
  return Array.isArray(value) ? value[0] : value
}

function parseSourceTypesParam(
  value: string | undefined
): ReservationSourceType[] | null {
  if (!value?.trim()) return null

  const parsed = value
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is ReservationSourceType =>
      VALID_SOURCE_TYPES.has(part)
    )

  return parsed.length > 0 ? parsed : null
}

function calendarTitleForSources(
  sourceTypes: ReservationSourceType[] | null,
  fallback: string
) {
  if (!sourceTypes || sourceTypes.length !== 1) return fallback

  switch (sourceTypes[0]) {
    case RESERVATION_SOURCE_TYPES.venueRental:
      return "Venue Rentals Calendar"
    case RESERVATION_SOURCE_TYPES.internalEvent:
      return "Events Calendar"
    case RESERVATION_SOURCE_TYPES.programFacility:
      return "Programs Calendar"
    default:
      return fallback
  }
}

async function loadEventFormOptions(
  canPlanEvents: boolean
): Promise<FacilityEventFormOptions | null> {
  if (!canPlanEvents) return null

  const [departments, eventTypes, venues, setupStyles, defaults] = await Promise.all([
    getDepartments(),
    getEventTypes({ activeOnly: true }),
    getActiveCalendarVenues(),
    getRoomSetupStyles({ activeOnly: true }),
    getInternalEventFormDefaults(),
  ])

  return {
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    eventTypes: eventTypes.map((t) => ({ id: t.id, name: t.name })),
    venues: venues.map((v) => ({ id: v.id, name: v.name })),
    setupStyles,
    defaults,
  }
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
  const sourceTypes = parseSourceTypesParam(getSearchParam(resolved, "sources"))

  const [data, canManageBlocks, canPlanEvents] = await Promise.all([
    getCalendarData(audience, anchorDate, view, { sourceTypes }),
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

  const planEvents =
    canPlanEvents && (audience === "staff" || audience === "ops")
  const eventFormOptions = await loadEventFormOptions(planEvents)

  const resolvedTitle =
    headerTitle ||
    calendarTitleForSources(sourceTypes, CALENDAR_AUDIENCE_LABELS[audience])

  return (
    <ReservationCalendar
      audience={audience}
      initialData={data}
      initialDate={dateParam || toDateParam(anchorDate)}
      initialView={view}
      canManageBlocks={canManageBlocks && audience === "ops" && !sourceTypes}
      canPlanEvents={planEvents}
      eventFormOptions={eventFormOptions}
      headerTitle={resolvedTitle}
      description={
        sourceTypes
          ? "Filtered view of the shared facility schedule — same data as Facilities Calendar."
          : CALENDAR_AUDIENCE_DESCRIPTIONS[audience]
      }
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

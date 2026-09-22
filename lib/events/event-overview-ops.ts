import { formatEventDate, formatEventTimeRange } from "./internal-event-format"
import {
  formatEventRecurrenceSchedule,
  isInternalEventRecurring,
} from "./event-recurrence"
import { resolveEventWorkspaceFeatures } from "./event-workspace-features"

export type EventOverviewOpsKpi = {
  id: string
  label: string
  value: string
  hint?: string
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

export type EventOverviewOpsEvent = {
  name?: string | null
  start_at?: string | null
  end_at?: string | null
  timezone?: string | null
  recurrence_config?: Record<string, unknown> | null
  location_type?: string | null
  location_label?: string | null
  location_address?: string | null
  venues?: { name: string } | null
  venueNames?: string[] | null
  requires_childcare?: boolean | null
  requires_volunteers?: boolean | null
  requires_vendors?: boolean | null
  requires_ticketing?: boolean | null
  workspace_features?: unknown
  ticketing_config?: { attendanceMode?: unknown } | null
}

export type EventOverviewOpsSibling = {
  name?: string | null
  start_at?: string | null
  end_at?: string | null
  timezone?: string | null
  recurrence_config?: Record<string, unknown> | null
}

function weekdayFromStart(startAt: string | null | undefined, timezone?: string | null) {
  if (!startAt) return null
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: timezone || "America/Chicago",
  }).format(new Date(startAt))
  const index = WEEKDAYS.indexOf(weekday)
  return index >= 0 ? index : null
}

export function formatEventOverviewLocation(event: EventOverviewOpsEvent) {
  const venueNames = (event.venueNames || [])
    .map((name) => name.trim())
    .filter(Boolean)
  if (venueNames.length > 0) return venueNames.join(", ")
  if (event.venues?.name?.trim()) return event.venues.name.trim()
  if (event.location_label?.trim()) return event.location_label.trim()
  if (event.location_type === "online") return "Online"
  if (event.location_type === "external") {
    return event.location_address?.trim() || "External venue"
  }
  return "—"
}

function neededLabel(needed: boolean) {
  return needed ? "Needed" : "Not needed"
}

export function buildEventOverviewOpsKpis(
  event: EventOverviewOpsEvent,
  siblings: EventOverviewOpsSibling[] = []
): EventOverviewOpsKpi[] {
  const related = siblings.length > 0 ? siblings : [event]
  const fromConfig = isInternalEventRecurring(event.recurrence_config)
  const isRecurring = fromConfig || related.length > 1
  const time = formatEventTimeRange(event.start_at ?? null, event.end_at ?? null)
  const fromConfigSchedule = formatEventRecurrenceSchedule(event.recurrence_config)

  let schedule = fromConfigSchedule
  if (!schedule && isRecurring) {
    const weekdays = Array.from(
      new Set(
        related
          .map((row) => weekdayFromStart(row.start_at ?? null, row.timezone))
          .filter((day): day is number => day != null)
      )
    )
    schedule =
      weekdays.length === 1
        ? `Every ${WEEKDAYS[weekdays[0]]}`
        : "Custom dates"
  }
  if (!schedule) {
    schedule = formatEventDate(event.start_at ?? null)
  }

  const features = resolveEventWorkspaceFeatures(event)

  return [
    {
      id: "type",
      label: "Type",
      value: isRecurring ? "Recurring" : "One-time",
    },
    {
      id: "schedule",
      label: "Schedule",
      value: schedule,
      hint: time,
    },
    {
      id: "location",
      label: "Location",
      value: formatEventOverviewLocation(event),
    },
    {
      id: "childcare",
      label: "Childcare",
      value: neededLabel(features.youth),
    },
    {
      id: "volunteers",
      label: "Volunteers",
      value: neededLabel(features.staff),
    },
    {
      id: "vendors",
      label: "Vendors",
      value: neededLabel(features.vendors),
    },
  ]
}

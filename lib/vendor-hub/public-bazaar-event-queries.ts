import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isVisibleOnCommunityCalendar } from "@/lib/vendor-hub/calendar-visibility"

export type PublicBazaarEvent = {
  id: string
  name: string
  eventDate: string | null
  startTime: string | null
  endTime: string | null
  location: string | null
  description: string | null
  flyerUrl: string | null
  calendarStatus: string | null
  status: string | null
  organizationId: string
  organizationName: string
  organizationSlug: string | null
  isPublished: boolean
}

function formatTimeLabel(time: string | null) {
  if (!time) return null

  const [hourPart, minutePart] = time.split(":")
  let hourNumber = Number(hourPart)
  const minute = minutePart?.slice(0, 2) ?? "00"
  const period = hourNumber >= 12 ? "PM" : "AM"

  if (hourNumber === 0) {
    hourNumber = 12
  } else if (hourNumber > 12) {
    hourNumber -= 12
  }

  return `${hourNumber}:${minute} ${period}`
}

export function formatBazaarEventSchedule(input: {
  eventDate: string | null
  startTime: string | null
  endTime: string | null
}) {
  if (!input.eventDate) {
    return null
  }

  const dateLabel = new Date(`${input.eventDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  const start = formatTimeLabel(input.startTime)
  const end = formatTimeLabel(input.endTime)

  if (start && end) {
    return `${dateLabel} · ${start} – ${end}`
  }

  if (start) {
    return `${dateLabel} · ${start}`
  }

  return dateLabel
}

export async function getPublicBazaarEventByShareToken(
  shareToken: string
): Promise<PublicBazaarEvent | null> {
  const token = shareToken.trim()
  if (!token) {
    return null
  }

  const supabase = createServiceRoleClient()

  const { data: event, error } = await supabase
    .from("vendor_hub_events")
    .select(
      "id, name, event_date, start_time, end_time, location, description, flyer_url, calendar_status, status, organization_id"
    )
    .eq("public_share_token", token)
    .maybeSingle()

  if (error || !event) {
    return null
  }

  if ((event.status as string | null) === "cancelled") {
    return null
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("name, slug")
    .eq("id", event.organization_id as string)
    .maybeSingle()

  return {
    id: event.id as string,
    name: event.name as string,
    eventDate: (event.event_date as string | null) ?? null,
    startTime: (event.start_time as string | null) ?? null,
    endTime: (event.end_time as string | null) ?? null,
    location: (event.location as string | null) ?? null,
    description: (event.description as string | null) ?? null,
    flyerUrl: (event.flyer_url as string | null) ?? null,
    calendarStatus: (event.calendar_status as string | null) ?? null,
    status: (event.status as string | null) ?? null,
    organizationId: event.organization_id as string,
    organizationName: (organization?.name as string | undefined) ?? "Community organization",
    organizationSlug: (organization?.slug as string | null) ?? null,
    isPublished: isVisibleOnCommunityCalendar(event.calendar_status as string | null),
  }
}

export const INTERNAL_EVENT_LOCATION_TYPES = {
  facility: "facility",
  online: "online",
  external: "external",
} as const

export type InternalEventLocationType =
  (typeof INTERNAL_EVENT_LOCATION_TYPES)[keyof typeof INTERNAL_EVENT_LOCATION_TYPES]

export const INTERNAL_EVENT_LOCATION_TYPE_LABELS: Record<
  InternalEventLocationType,
  string
> = {
  facility: "Center",
  online: "Online",
  external: "External Venue",
}

/** Short labels for compact lists (e.g. Event Management overview). */
export const INTERNAL_EVENT_LOCATION_TYPE_SHORT_LABELS: Record<
  InternalEventLocationType,
  string
> = {
  facility: "Center",
  online: "Online",
  external: "External",
}

export function isInternalEventLocationType(
  value: string | null | undefined
): value is InternalEventLocationType {
  return (
    value === INTERNAL_EVENT_LOCATION_TYPES.facility ||
    value === INTERNAL_EVENT_LOCATION_TYPES.online ||
    value === INTERNAL_EVENT_LOCATION_TYPES.external
  )
}

/** UI hint only — does not invent a type for legacy rows without venue. */
export function inferInternalEventLocationType(event: {
  location_type?: string | null
  venue_id?: string | null
}): InternalEventLocationType | "" {
  if (isInternalEventLocationType(event.location_type)) {
    return event.location_type
  }
  if (event.venue_id) {
    return INTERNAL_EVENT_LOCATION_TYPES.facility
  }
  return ""
}

export function getInternalEventLocationTypeLabel(
  event: {
    location_type?: string | null
    venue_id?: string | null
  },
  options?: { short?: boolean }
): string {
  const type = inferInternalEventLocationType(event)
  if (!type) return "—"
  return options?.short
    ? INTERNAL_EVENT_LOCATION_TYPE_SHORT_LABELS[type]
    : INTERNAL_EVENT_LOCATION_TYPE_LABELS[type]
}

export function formatInternalEventLocation(event: {
  location_type?: string | null
  location_label?: string | null
  location_address?: string | null
  venues?: { name?: string | null } | null
  venueNames?: string[] | null
}): string {
  if (event.location_type === INTERNAL_EVENT_LOCATION_TYPES.online) {
    return "Online"
  }

  if (event.location_type === INTERNAL_EVENT_LOCATION_TYPES.external) {
    const name = event.location_label?.trim()
    const address = event.location_address?.trim()
    if (name && address) return `${name} — ${address}`
    return name || address || "External venue"
  }

  const multi = (event.venueNames || []).map((name) => name.trim()).filter(Boolean)
  if (multi.length > 0) return multi.join(", ")
  return event.venues?.name || event.location_label?.trim() || "Not specified"
}

/** Space/location for overview lists — no meeting links. */
export function formatInternalEventSpaceLabel(event: {
  location_type?: string | null
  location_label?: string | null
  venues?: { name?: string | null } | null
  venueNames?: string[] | null
  venue_id?: string | null
}): string {
  const type = inferInternalEventLocationType(event)

  if (type === INTERNAL_EVENT_LOCATION_TYPES.online) {
    return "—"
  }

  if (type === INTERNAL_EVENT_LOCATION_TYPES.external) {
    return event.location_label?.trim() || "—"
  }

  const multi = (event.venueNames || []).map((name) => name.trim()).filter(Boolean)
  if (multi.length > 0) return multi.join(", ")
  return event.venues?.name?.trim() || event.location_label?.trim() || "—"
}

/** Prefer http(s) meeting links stored on online events (`location_address`). */
export function getInternalEventMeetingLink(event: {
  location_type?: string | null
  location_label?: string | null
  location_address?: string | null
}): string | null {
  if (event.location_type !== INTERNAL_EVENT_LOCATION_TYPES.online) return null
  for (const value of [event.location_address, event.location_label]) {
    const trimmed = value?.trim()
    if (!trimmed || trimmed.toLowerCase() === "online") continue
    if (/^https?:\/\//i.test(trimmed)) return trimmed
  }
  return null
}

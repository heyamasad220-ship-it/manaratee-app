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

export function formatInternalEventLocation(event: {
  location_type?: string | null
  location_label?: string | null
  location_address?: string | null
  venues?: { name?: string | null } | null
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

  return event.venues?.name || event.location_label?.trim() || "Not specified"
}

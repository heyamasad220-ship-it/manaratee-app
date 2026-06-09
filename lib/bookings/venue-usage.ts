export const VENUE_USAGE_TAGS = {
  internal: "internal",
  external: "external",
} as const

export type VenueUsageTag =
  (typeof VENUE_USAGE_TAGS)[keyof typeof VENUE_USAGE_TAGS]

export function normalizeVenueUsageTag(
  value: string | null | undefined
): VenueUsageTag {
  return value?.trim().toLowerCase() === VENUE_USAGE_TAGS.external
    ? VENUE_USAGE_TAGS.external
    : VENUE_USAGE_TAGS.internal
}

export function getVenueUsageTagLabel(tag: VenueUsageTag): string {
  return tag === VENUE_USAGE_TAGS.external ? "External" : "Internal"
}

export function getVenueUsageTagDescription(tag: VenueUsageTag): string {
  return tag === VENUE_USAGE_TAGS.external
    ? "Available for Venue Rentals (customer and paid bookings)."
    : "Available for Event Management and Programs (department-owned use)."
}

export function formatVenueAvailabilityWindow(
  start: string | null | undefined,
  end: string | null | undefined
): string | null {
  const startLabel = formatVenueTimeLabel(start)
  const endLabel = formatVenueTimeLabel(end)

  if (!startLabel && !endLabel) {
    return null
  }

  if (startLabel && endLabel) {
    return `${startLabel} – ${endLabel}`
  }

  return startLabel || endLabel
}

export function formatVenueTimeLabel(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null
  }

  const [hourPart, minutePart = "00"] = value.trim().slice(0, 5).split(":")
  const hour = Number(hourPart)
  const minute = Number(minutePart)

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return value
  }

  const ampm = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  const displayMinute = minute.toString().padStart(2, "0")

  return `${displayHour}:${displayMinute} ${ampm}`
}

export function toVenueTimeInputValue(value: string | null | undefined): string {
  if (!value?.trim()) {
    return ""
  }

  return value.trim().slice(0, 5)
}

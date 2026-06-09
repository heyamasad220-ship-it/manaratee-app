export function operationalBriefSourceHref(
  sourceType: string,
  sourceId: string | null | undefined
): string | null {
  if (!sourceId) {
    return null
  }

  switch (sourceType) {
    case "internal_event":
      return `/event-management/${sourceId}`
    case "venue_rental":
      return `/bookings/rentals/${sourceId}`
    case "program":
      return `/programs/${sourceId}`
    case "maintenance":
      return "/facilities/calendar"
    default:
      return null
  }
}

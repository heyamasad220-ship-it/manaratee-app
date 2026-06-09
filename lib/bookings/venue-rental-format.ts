export function shortVenueRentalId(id: string): string {
  return `#${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`
}

export function formatVenueRentalDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—"
  }

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function formatVenueRentalTimeRange(startAt: string, endAt: string): string {
  const start = new Date(startAt)
  const end = new Date(endAt)

  const sameDay = start.toDateString() === end.toDateString()

  if (sameDay) {
    return `${start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })} · ${start.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })} – ${end.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`
  }

  return `${formatVenueRentalDateTime(startAt)} – ${formatVenueRentalDateTime(endAt)}`
}

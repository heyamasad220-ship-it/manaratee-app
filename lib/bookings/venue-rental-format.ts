export function shortVenueRentalId(id: string): string {
  return `#${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`
}

function nthSunday(year: number, monthIndex0: number, n: number) {
  const first = new Date(Date.UTC(year, monthIndex0, 1))
  const day = first.getUTCDay()
  const firstSunday = 1 + ((7 - day) % 7)
  return firstSunday + (n - 1) * 7
}

/** Central Time offset minutes east of UTC (negative). DST: 2nd Sun Mar → 1st Sun Nov. */
function chicagoOffsetMinutes(year: number, month: number, day: number) {
  const dstStart = nthSunday(year, 2, 2)
  const dstEnd = nthSunday(year, 10, 1)
  const inDst =
    month > 3 && month < 11
      ? true
      : month === 3
        ? day >= dstStart
        : month === 11
          ? day < dstEnd
          : false
  return inDst ? -300 : -360
}

/**
 * Parse Google Form "Form submitted: …" timestamps from import notes.
 * Typical sheet values: "7/22/2026 1:58:17" or "7/22/2026 1:58:17 PM" (America/Chicago).
 */
export function parseVenueRentalFormSubmittedAt(
  notes: string | null | undefined
): string | null {
  if (!notes) return null

  const match = notes.match(/Form submitted:\s*(.+?)(?:\n|$)/i)
  if (!match) return null

  const raw = match[1].trim()
  if (!raw || /^n\/a$/i.test(raw)) return null

  const sheetMatch = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i
  )

  if (sheetMatch) {
    const month = Number(sheetMatch[1])
    const day = Number(sheetMatch[2])
    const year = Number(sheetMatch[3])
    let hour = Number(sheetMatch[4])
    const minute = Number(sheetMatch[5])
    const second = Number(sheetMatch[6] || 0)
    const meridiem = sheetMatch[7]?.toUpperCase()

    if (meridiem === "PM" && hour < 12) hour += 12
    if (meridiem === "AM" && hour === 12) hour = 0

    const offsetMin = chicagoOffsetMinutes(year, month, day)
    const utcMs =
      Date.UTC(year, month - 1, day, hour, minute, second) - offsetMin * 60_000
    return new Date(utcMs).toISOString()
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

/** Prefer form submission time from notes; fall back to row created_at. */
export function resolveVenueRentalSubmittedAt(
  notes: string | null | undefined,
  createdAt: string
): string {
  return parseVenueRentalFormSubmittedAt(notes) ?? createdAt
}

/** Parse "Event type: …" from Google Form import notes. */
export function parseVenueRentalEventTypeFromNotes(
  notes: string | null | undefined
): string | null {
  if (!notes) return null
  const match = notes.match(/Event type:\s*(.+?)(?:\n|$)/i)
  const value = match?.[1]?.trim()
  return value || null
}

/** Prefer import-notes event type; fall back to catalog name. */
export function resolveVenueRentalEventTypeName(
  notes: string | null | undefined,
  catalogName: string | null | undefined
): string | null {
  return parseVenueRentalEventTypeFromNotes(notes) || catalogName || null
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

/** e.g. "Youth Lounge, July 30, 2026, 6-10pm" */
export function formatVenueRentalSpaceLine(
  venueName: string,
  startAt: string,
  endAt: string
): string {
  const start = new Date(startAt)
  const end = new Date(endAt)
  const date = start.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  const startHour = start.getHours()
  const endHour = end.getHours()
  const startMinutes = start.getMinutes()
  const endMinutes = end.getMinutes()
  const startMeridiem = startHour >= 12 ? "pm" : "am"
  const endMeridiem = endHour >= 12 ? "pm" : "am"
  const startDisplay = startHour % 12 || 12
  const endDisplay = endHour % 12 || 12
  const startPart =
    startMinutes === 0
      ? String(startDisplay)
      : `${startDisplay}:${String(startMinutes).padStart(2, "0")}`
  const endPart =
    endMinutes === 0
      ? String(endDisplay)
      : `${endDisplay}:${String(endMinutes).padStart(2, "0")}`

  const time =
    startMeridiem === endMeridiem
      ? `${startPart}-${endPart}${endMeridiem}`
      : `${startPart}${startMeridiem}-${endPart}${endMeridiem}`

  return `${venueName}, ${date}, ${time}`
}

/**
 * Hide Google Form import metadata from staff UI; keep only the customer's Notes line when present.
 */
export function getVenueRentalDisplayNotes(
  notes: string | null | undefined
): string | null {
  if (!notes?.trim()) return null

  if (/VENUE_RENTAL_GOOGLE_FORM_V1/i.test(notes)) {
    const match = notes.match(
      /^Notes:\s*(.+?)(?=\n(?:\[|VENUE_RENTAL_|Form submitted|Sheet |Event type|Setup:|Food:|Special needs|Admission|\(Payments)|$)/ims
    )
    const customerNotes = match?.[1]?.trim()
    return customerNotes || null
  }

  return notes.trim()
}

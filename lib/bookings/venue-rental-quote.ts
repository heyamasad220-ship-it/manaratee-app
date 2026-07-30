/**
 * Quoted venue rental charges from requested spaces (+ optional add-ons).
 * Used for Payments Total Charges (not payment line-item sums).
 *
 * Space fee for each reserved slot:
 * 1. Day-of-week flat price for that space (when set)
 * 2. Else hours × day-of-week hourly rate (legacy venue hourly as fallback)
 *
 * Day of week is resolved in America/Chicago (venue rental org timezone).
 */

export type VenueRentalQuoteSpace = {
  venueId: string
  startAt: string
  endAt: string
}

export type VenueRentalQuoteAddon = {
  quantity: number
  unitPrice: number
}

export type VenueRateLookup = {
  /** Fallback hourly rate when no day-of-week hourly is set. */
  legacyHourlyByVenue: Map<string, number>
  /** Fallback flat fee when no day-of-week flat is set (weekday / peak by day). */
  legacyFlatByVenue: Map<string, { weekday: number; weekend: number }>
  /** venueId → dayOfWeek (0=Sun) → hourly price */
  dayHourlyByVenue: Map<string, Map<number, number>>
  /** venueId → dayOfWeek (0=Sun) → flat price */
  dayFlatByVenue: Map<string, Map<number, number>>
}

export type VenueRentalQuotedCharges = {
  spaceFee: number
  addonFees: number
  totalCharges: number
  hours: number
}

export function hoursBetween(startAt: string, endAt: string): number {
  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  return Math.max(0, (end - start) / (1000 * 60 * 60))
}

/** JS Date#getDay() equivalent in America/Chicago for an ISO timestamp. */
export function chicagoDayOfWeek(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
  }).formatToParts(new Date(iso))
  const weekday = parts.find((part) => part.type === "weekday")?.value
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return map[weekday || ""] ?? new Date(iso).getDay()
}

function isWeekendDay(dayOfWeek: number): boolean {
  return dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6
}

export function resolveVenueFlatRate(
  venueId: string,
  startAt: string,
  rates: VenueRateLookup
): number {
  const dayOfWeek = chicagoDayOfWeek(startAt)
  const dayFlat = rates.dayFlatByVenue.get(venueId)?.get(dayOfWeek)
  if (dayFlat != null && dayFlat > 0) return dayFlat

  const legacy = rates.legacyFlatByVenue.get(venueId)
  if (!legacy) return 0
  return isWeekendDay(dayOfWeek) ? legacy.weekend || legacy.weekday : legacy.weekday
}

export function resolveVenueHourlyRate(
  venueId: string,
  startAt: string,
  rates: VenueRateLookup
): number {
  const dayOfWeek = chicagoDayOfWeek(startAt)
  const dayRate = rates.dayHourlyByVenue.get(venueId)?.get(dayOfWeek)
  if (dayRate != null && dayRate > 0) return dayRate
  return rates.legacyHourlyByVenue.get(venueId) || 0
}

/**
 * Prefer flat day price for the requested date; otherwise hours × hourly.
 * Multiple spaces each contribute their own fee.
 */
export function computeVenueRentalSpaceFee(
  spaces: VenueRentalQuoteSpace[],
  rates: VenueRateLookup
): { spaceFee: number; hours: number } {
  let hours = 0
  let spaceFee = 0

  for (const space of spaces) {
    const slotHours = hoursBetween(space.startAt, space.endAt)
    hours += slotHours
    const flat = resolveVenueFlatRate(space.venueId, space.startAt, rates)
    if (flat > 0) {
      spaceFee += flat
      continue
    }
    const hourly = resolveVenueHourlyRate(space.venueId, space.startAt, rates)
    spaceFee += slotHours * hourly
  }

  return {
    spaceFee: Math.round(spaceFee * 100) / 100,
    hours: Math.round(hours * 100) / 100,
  }
}

export function computeVenueRentalAddonFees(
  addons: VenueRentalQuoteAddon[]
): number {
  const total = addons.reduce(
    (sum, addon) => sum + Number(addon.quantity || 0) * Number(addon.unitPrice || 0),
    0
  )
  return Math.round(total * 100) / 100
}

/** Space fee for requested slots + add-ons selected on the request. */
export function computeVenueRentalQuotedCharges(
  spaces: VenueRentalQuoteSpace[],
  addons: VenueRentalQuoteAddon[],
  rates: VenueRateLookup
): VenueRentalQuotedCharges {
  const { spaceFee, hours } = computeVenueRentalSpaceFee(spaces, rates)
  const addonFees = computeVenueRentalAddonFees(addons)
  return {
    spaceFee,
    addonFees,
    totalCharges: Math.round((spaceFee + addonFees) * 100) / 100,
    hours,
  }
}

export function emptyVenueRateLookup(): VenueRateLookup {
  return {
    legacyHourlyByVenue: new Map(),
    legacyFlatByVenue: new Map(),
    dayHourlyByVenue: new Map(),
    dayFlatByVenue: new Map(),
  }
}

export function buildVenueRateLookup(input: {
  venues: Array<{
    id: string
    hourly_rate?: number | null
    peak_hourly_rate?: number | null
    base_price?: number | null
    peak_flat_price?: number | null
  }>
  dayPricing: Array<{
    venue_id: string
    day_of_week: number
    hourly_price?: number | null
    flat_price?: number | null
    is_active?: boolean | null
  }>
}): VenueRateLookup {
  const legacyHourlyByVenue = new Map(
    input.venues.map((venue) => [
      venue.id,
      Number(venue.hourly_rate || venue.peak_hourly_rate || 0),
    ])
  )

  const legacyFlatByVenue = new Map(
    input.venues.map((venue) => [
      venue.id,
      {
        weekday: Number(venue.base_price || 0),
        weekend: Number(
          venue.peak_flat_price || venue.base_price || 0
        ),
      },
    ])
  )

  const dayHourlyByVenue = new Map<string, Map<number, number>>()
  const dayFlatByVenue = new Map<string, Map<number, number>>()

  for (const row of input.dayPricing) {
    if (row.is_active === false) continue

    const byHourly = dayHourlyByVenue.get(row.venue_id) || new Map<number, number>()
    byHourly.set(Number(row.day_of_week), Number(row.hourly_price || 0))
    dayHourlyByVenue.set(row.venue_id, byHourly)

    const byFlat = dayFlatByVenue.get(row.venue_id) || new Map<number, number>()
    byFlat.set(Number(row.day_of_week), Number(row.flat_price || 0))
    dayFlatByVenue.set(row.venue_id, byFlat)
  }

  return {
    legacyHourlyByVenue,
    legacyFlatByVenue,
    dayHourlyByVenue,
    dayFlatByVenue,
  }
}

export const VENUE_STATUSES = {
  active: "active",
  inactive: "inactive",
  maintenance: "maintenance",
} as const

export type VenueStatus = (typeof VENUE_STATUSES)[keyof typeof VENUE_STATUSES]

export interface VenueRecord {
  id: string
  organization_id: string
  name: string
  description: string | null
  location: string | null
  capacity: number
  base_price: number
  hourly_rate: number
  peak_flat_price: number
  peak_hourly_rate: number
  available_for_bookings: boolean
  availability_start: string | null
  availability_end: string | null
  amenities: string[]
  status: VenueStatus
  created_at: string
  updated_at: string
}

export interface VenueWithStats extends VenueRecord {
  totalBookings: number
  revenue: number
}

export function getVenueStatusLabel(status: VenueStatus): string {
  switch (status) {
    case "active":
      return "Active"
    case "inactive":
      return "Inactive"
    case "maintenance":
      return "Maintenance"
    default:
      return status
  }
}

export function normalizeVenueStatus(value: string | null | undefined): VenueStatus {
  const normalized = value?.trim().toLowerCase()

  if (normalized === VENUE_STATUSES.inactive) {
    return VENUE_STATUSES.inactive
  }

  if (normalized === VENUE_STATUSES.maintenance) {
    return VENUE_STATUSES.maintenance
  }

  return VENUE_STATUSES.active
}

export function parseAmenities(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean)
  }

  if (!value?.trim()) {
    return []
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export function getVenueSummaryStats(venues: VenueWithStats[]) {
  return {
    totalVenues: venues.length,
    activeVenues: venues.filter((venue) => venue.status === "active").length,
    totalCapacity: venues.reduce((sum, venue) => sum + venue.capacity, 0),
    totalRevenue: venues.reduce((sum, venue) => sum + venue.revenue, 0),
  }
}

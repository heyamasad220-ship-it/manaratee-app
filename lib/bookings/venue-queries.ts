import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

import {
  normalizeVenueStatus,
  parseAmenities,
  type VenueRecord,
  type VenueWithStats,
} from "./venue-types"
import { normalizeVenueUsageTag } from "./venue-usage"

type VenueRow = {
  id: string
  organization_id: string
  name: string
  description: string | null
  location: string | null
  capacity: number | null
  max_capacity?: number | null
  base_price: number | string | null
  hourly_rate: number | string | null
  peak_flat_price?: number | string | null
  peak_hourly_rate?: number | string | null
  available_for_bookings?: boolean | null
  usage_tag?: string | null
  availability_start?: string | null
  availability_end?: string | null
  amenities: string[] | null
  status: string | null
  created_at: string
  updated_at: string
}

type VenueBookingStatsRow = {
  venue_id: string
  total_amount: number | string | null
}

const EXCLUDED_BOOKING_STATUSES = ["cancelled", "rejected"]

function resolveAvailableForBookings(row: VenueRow): boolean {
  if (typeof row.available_for_bookings === "boolean") {
    return row.available_for_bookings
  }

  if (row.usage_tag) {
    return normalizeVenueUsageTag(row.usage_tag) === "external"
  }

  return false
}

function mapVenueRow(row: VenueRow): VenueRecord {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    description: row.description,
    location: row.location,
    capacity: Number(row.capacity ?? row.max_capacity ?? 0),
    base_price: Number(row.base_price ?? 0),
    hourly_rate: Number(row.hourly_rate ?? 0),
    peak_flat_price: Number(row.peak_flat_price ?? row.base_price ?? 0),
    peak_hourly_rate: Number(row.peak_hourly_rate ?? row.hourly_rate ?? 0),
    available_for_bookings: resolveAvailableForBookings(row),
    availability_start: row.availability_start ?? null,
    availability_end: row.availability_end ?? null,
    amenities: parseAmenities(row.amenities),
    status: normalizeVenueStatus(row.status),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

const venueSelectColumns = `
  id,
  organization_id,
  name,
  description,
  location,
  capacity,
  max_capacity,
  base_price,
  hourly_rate,
  peak_flat_price,
  peak_hourly_rate,
  available_for_bookings,
  usage_tag,
  availability_start,
  availability_end,
  amenities,
  status,
  created_at,
  updated_at
`

const legacyVenueSelectColumns = `
  id,
  organization_id,
  name,
  description,
  location,
  capacity,
  max_capacity,
  base_price,
  hourly_rate,
  amenities,
  status,
  created_at,
  updated_at
`

function isMissingVenueColumnError(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? ""
  return (
    message.includes("available_for_bookings") ||
    message.includes("usage_tag") ||
    message.includes("peak_flat_price") ||
    message.includes("peak_hourly_rate") ||
    message.includes("availability_start") ||
    message.includes("availability_end") ||
    message.includes("does not exist")
  )
}

async function fetchOrganizationVenueRows(
  organizationId: string,
  options?: { venueId?: string }
) {
  const supabase = await createClient()

  let query = supabase
    .from("venues")
    .select(venueSelectColumns)
    .eq("organization_id", organizationId)

  if (options?.venueId) {
    query = query.eq("id", options.venueId).maybeSingle()
  } else {
    query = query.order("name", { ascending: true })
  }

  let result = await query

  if (result.error && isMissingVenueColumnError(result.error)) {
    let legacyQuery = supabase
      .from("venues")
      .select(legacyVenueSelectColumns)
      .eq("organization_id", organizationId)

    if (options?.venueId) {
      legacyQuery = legacyQuery.eq("id", options.venueId).maybeSingle()
    } else {
      legacyQuery = legacyQuery.order("name", { ascending: true })
    }

    result = await legacyQuery
  }

  return result
}

export async function venueCatalogSupportsExtendedFields(): Promise<boolean> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return false
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("venues")
    .select("available_for_bookings, peak_flat_price")
    .eq("organization_id", organizationId)
    .limit(1)

  if (!error) {
    return true
  }

  return !isMissingVenueColumnError(error)
}

async function getVenueBookingStats(organizationId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("venue_bookings")
    .select("venue_id, total_amount, status")
    .eq("organization_id", organizationId)

  if (error) {
    if (error.code === "42P01") {
      return new Map<string, { totalBookings: number; revenue: number }>()
    }

    console.error(error)
    return new Map<string, { totalBookings: number; revenue: number }>()
  }

  const stats = new Map<string, { totalBookings: number; revenue: number }>()

  for (const row of (data || []) as (VenueBookingStatsRow & { status: string | null })[]) {
    const status = row.status?.toLowerCase() || ""

    if (EXCLUDED_BOOKING_STATUSES.includes(status)) {
      continue
    }

    const current = stats.get(row.venue_id) || { totalBookings: 0, revenue: 0 }

    current.totalBookings += 1
    current.revenue += Number(row.total_amount || 0)
    stats.set(row.venue_id, current)
  }

  return stats
}

export async function getVenues(): Promise<VenueRecord[]> {
  const venues = await getVenuesWithStats()
  return venues.map(({ totalBookings: _totalBookings, revenue: _revenue, ...venue }) => venue)
}

export async function getVenuesWithStats(): Promise<VenueWithStats[]> {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await fetchOrganizationVenueRows(organizationId)

  if (error) {
    console.error(error)
    throw new Error("Failed to load venues")
  }

  const rows = (Array.isArray(data) ? data : data ? [data] : []) as VenueRow[]
  const bookingStats = await getVenueBookingStats(organizationId)

  return rows.map((row) => {
    const venue = mapVenueRow(row)
    const stats = bookingStats.get(venue.id) || { totalBookings: 0, revenue: 0 }

    return {
      ...venue,
      totalBookings: stats.totalBookings,
      revenue: stats.revenue,
    }
  })
}

export async function getVenueById(id: string): Promise<VenueRecord | null> {
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return null
  }

  const { data, error } = await fetchOrganizationVenueRows(organizationId, {
    venueId: id,
  })

  if (error) {
    console.error(error)
    return null
  }

  if (!data || Array.isArray(data)) {
    return null
  }

  return mapVenueRow(data as VenueRow)
}

export async function getBookableVenues(): Promise<VenueRecord[]> {
  const venues = await getVenuesWithStats()
  return venues
    .filter((venue) => venue.available_for_bookings && venue.status === "active")
    .map(({ totalBookings: _totalBookings, revenue: _revenue, ...venue }) => venue)
}

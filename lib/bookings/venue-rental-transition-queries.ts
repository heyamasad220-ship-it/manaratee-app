import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { reservationStatusBlocksBooking } from "@/lib/reservations/reservation-conflict-rules"

import {
  classifyReservationSyncOrigin,
  isLegacyNewDuplicatePair,
  type VenueRentalReservationSyncOrigin,
} from "./venue-rental-transition"

export type DuplicateVenueRentalBlockReportRow = {
  organizationId: string
  venueId: string
  reservationAId: string
  reservationASourceId: string
  reservationAOrigin: VenueRentalReservationSyncOrigin | "unknown"
  reservationBId: string
  reservationBSourceId: string
  reservationBOrigin: VenueRentalReservationSyncOrigin | "unknown"
  overlapStart: string
  overlapEnd: string
  isLegacyNewPair: boolean
}

export type DuplicateVenueRentalBlockReport = {
  organizationId: string
  rows: DuplicateVenueRentalBlockReportRow[]
  legacyNewPairCount: number
  totalDuplicatePairCount: number
}

type ResourceReservationRow = {
  id: string
  organization_id: string
  venue_id: string | null
  start_at: string
  end_at: string
  source_id: string | null
  status: string
  metadata: Record<string, unknown> | null
}

function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return new Date(aStart).getTime() < new Date(bEnd).getTime() &&
    new Date(aEnd).getTime() > new Date(bStart).getTime()
}

function overlapBounds(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const start = new Date(Math.max(new Date(aStart).getTime(), new Date(bStart).getTime()))
  const end = new Date(Math.min(new Date(aEnd).getTime(), new Date(bEnd).getTime()))

  return {
    overlapStart: start.toISOString(),
    overlapEnd: end.toISOString(),
  }
}

async function loadSourceIdSets(
  organizationId: string,
  sourceIds: string[]
): Promise<{
  legacyVenueBookingSourceIds: Set<string>
  rentalReservationSourceIds: Set<string>
}> {
  const supabase = await createClient()
  const uniqueSourceIds = Array.from(new Set(sourceIds.filter(Boolean)))

  if (!uniqueSourceIds.length) {
    return {
      legacyVenueBookingSourceIds: new Set(),
      rentalReservationSourceIds: new Set(),
    }
  }

  const [legacyResult, rentalResult] = await Promise.all([
    supabase
      .from("venue_bookings")
      .select("id")
      .eq("organization_id", organizationId)
      .in("id", uniqueSourceIds),
    supabase
      .from("rental_reservations")
      .select("id")
      .eq("organization_id", organizationId)
      .in("id", uniqueSourceIds),
  ])

  return {
    legacyVenueBookingSourceIds: new Set(
      (legacyResult.data || []).map((row) => row.id as string)
    ),
    rentalReservationSourceIds: new Set(
      (rentalResult.data || []).map((row) => row.id as string)
    ),
  }
}

function buildDuplicateRows(
  organizationId: string,
  reservations: ResourceReservationRow[],
  legacyVenueBookingSourceIds: Set<string>,
  rentalReservationSourceIds: Set<string>
): DuplicateVenueRentalBlockReportRow[] {
  const rows: DuplicateVenueRentalBlockReportRow[] = []

  for (let index = 0; index < reservations.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < reservations.length; otherIndex += 1) {
      const a = reservations[index]
      const b = reservations[otherIndex]

      if (!a.venue_id || !b.venue_id || a.venue_id !== b.venue_id) {
        continue
      }

      if (!a.source_id || !b.source_id || a.source_id === b.source_id) {
        continue
      }

      if (!rangesOverlap(a.start_at, a.end_at, b.start_at, b.end_at)) {
        continue
      }

      const reservationAOrigin = classifyReservationSyncOrigin({
        sourceId: a.source_id,
        metadataSyncOrigin:
          typeof a.metadata?.sync_origin === "string" ? a.metadata.sync_origin : null,
        legacyVenueBookingSourceIds,
        rentalReservationSourceIds,
      })
      const reservationBOrigin = classifyReservationSyncOrigin({
        sourceId: b.source_id,
        metadataSyncOrigin:
          typeof b.metadata?.sync_origin === "string" ? b.metadata.sync_origin : null,
        legacyVenueBookingSourceIds,
        rentalReservationSourceIds,
      })

      const { overlapStart, overlapEnd } = overlapBounds(
        a.start_at,
        a.end_at,
        b.start_at,
        b.end_at
      )

      rows.push({
        organizationId,
        venueId: a.venue_id,
        reservationAId: a.id,
        reservationASourceId: a.source_id,
        reservationAOrigin,
        reservationBId: b.id,
        reservationBSourceId: b.source_id,
        reservationBOrigin,
        overlapStart,
        overlapEnd,
        isLegacyNewPair: isLegacyNewDuplicatePair(reservationAOrigin, reservationBOrigin),
      })
    }
  }

  return rows
}

/** Find overlapping venue_rental resource_reservations with different source_id values. */
export async function getDuplicateVenueRentalBlockReport(
  organizationId?: string
): Promise<DuplicateVenueRentalBlockReport> {
  const supabase = await createClient()
  const resolvedOrganizationId = organizationId ?? (await getSelectedOrganizationId())

  if (!resolvedOrganizationId) {
    throw new Error("No organization selected")
  }

  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    "find_duplicate_venue_rental_blocks",
    { p_organization_id: resolvedOrganizationId }
  )

  if (!rpcError && rpcRows) {
    const rows = (rpcRows as Array<Record<string, unknown>>).map((row) => ({
      organizationId: row.organization_id as string,
      venueId: row.venue_id as string,
      reservationAId: row.reservation_a_id as string,
      reservationASourceId: row.reservation_a_source_id as string,
      reservationAOrigin: row.reservation_a_sync_origin as VenueRentalReservationSyncOrigin | "unknown",
      reservationBId: row.reservation_b_id as string,
      reservationBSourceId: row.reservation_b_source_id as string,
      reservationBOrigin: row.reservation_b_sync_origin as VenueRentalReservationSyncOrigin | "unknown",
      overlapStart: row.overlap_start as string,
      overlapEnd: row.overlap_end as string,
      isLegacyNewPair: Boolean(row.is_legacy_new_pair),
    }))

    return {
      organizationId: resolvedOrganizationId,
      rows,
      legacyNewPairCount: rows.filter((row) => row.isLegacyNewPair).length,
      totalDuplicatePairCount: rows.length,
    }
  }

  const { data, error } = await supabase
    .from("resource_reservations")
    .select("id, organization_id, venue_id, start_at, end_at, source_id, status, metadata")
    .eq("organization_id", resolvedOrganizationId)
    .eq("source_type", "venue_rental")
    .not("venue_id", "is", null)
    .not("source_id", "is", null)

  if (error) {
    if (error.code === "42P01") {
      return {
        organizationId: resolvedOrganizationId,
        rows: [],
        legacyNewPairCount: 0,
        totalDuplicatePairCount: 0,
      }
    }

    throw new Error(error.message || "Failed to load resource reservations for duplicate report")
  }

  const blocking = (data || []).filter((row) =>
    reservationStatusBlocksBooking(row.status as string)
  ) as ResourceReservationRow[]

  const sourceIds = blocking
    .map((row) => row.source_id)
    .filter((value): value is string => Boolean(value))

  const { legacyVenueBookingSourceIds, rentalReservationSourceIds } =
    await loadSourceIdSets(resolvedOrganizationId, sourceIds)

  const rows = buildDuplicateRows(
    resolvedOrganizationId,
    blocking,
    legacyVenueBookingSourceIds,
    rentalReservationSourceIds
  )

  return {
    organizationId: resolvedOrganizationId,
    rows,
    legacyNewPairCount: rows.filter((row) => row.isLegacyNewPair).length,
    totalDuplicatePairCount: rows.length,
  }
}

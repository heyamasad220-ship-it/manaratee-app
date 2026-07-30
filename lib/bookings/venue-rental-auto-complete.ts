import type { SupabaseClient } from "@supabase/supabase-js"

import {
  VENUE_RENTAL_STATUSES,
  type VenueRentalStatus,
} from "./venue-rental-types"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

/**
 * Confirmed bookings become Completed after the last reserved slot ends.
 * Legacy deposit statuses that display as Confirmed are included.
 */
export const VENUE_RENTAL_AUTO_COMPLETE_STATUSES: VenueRentalStatus[] = [
  VENUE_RENTAL_STATUSES.confirmed,
  VENUE_RENTAL_STATUSES.depositPaid,
  VENUE_RENTAL_STATUSES.securityDepositPaid,
]

export type VenueRentalEndCandidate = {
  id: string
  organization_id: string
  status: string
  latestEndAt: string
}

export type CompletePastVenueRentalsResult = {
  completedCount: number
  completedRentalIds: string[]
  completedByOrganization: Record<string, string[]>
}

export function selectPastEventRentals(
  rentals: VenueRentalEndCandidate[],
  now: Date = new Date()
): VenueRentalEndCandidate[] {
  const completeable = new Set<string>(VENUE_RENTAL_AUTO_COMPLETE_STATUSES)
  const nowMs = now.getTime()

  return rentals.filter((rental) => {
    if (!completeable.has(rental.status)) {
      return false
    }

    const endMs = new Date(rental.latestEndAt).getTime()
    return Number.isFinite(endMs) && endMs <= nowMs
  })
}

export function groupVenueRentalIdsByOrganization(
  rentals: Array<{ id: string; organization_id: string }>
): Record<string, string[]> {
  const grouped: Record<string, string[]> = {}

  for (const rental of rentals) {
    if (!grouped[rental.organization_id]) {
      grouped[rental.organization_id] = []
    }
    grouped[rental.organization_id].push(rental.id)
  }

  return grouped
}

/**
 * Mark confirmed rentals Completed once their latest reservation `end_at` has passed.
 * Idempotent: only updates rentals still in auto-complete statuses.
 */
export async function completePastConfirmedVenueRentalsForScope(input: {
  supabase: SupabaseClient
  organizationId?: string
  now?: Date
}): Promise<CompletePastVenueRentalsResult> {
  const now = input.now ?? new Date()

  let rentalQuery = input.supabase
    .from("venue_rentals")
    .select("id, organization_id, status")
    .in("status", VENUE_RENTAL_AUTO_COMPLETE_STATUSES)

  if (input.organizationId) {
    rentalQuery = rentalQuery.eq("organization_id", input.organizationId)
  }

  const { data: rentals, error: rentalError } = await rentalQuery

  if (rentalError) {
    throw new Error(
      rentalError.message || "Failed to load rentals for auto-complete"
    )
  }

  const rentalRows = (rentals || []) as Array<{
    id: string
    organization_id: string
    status: string
  }>

  if (!rentalRows.length) {
    return {
      completedCount: 0,
      completedRentalIds: [],
      completedByOrganization: {},
    }
  }

  const rentalIds = rentalRows.map((row) => row.id)

  let reservationQuery = input.supabase
    .from("rental_reservations")
    .select("venue_rental_id, end_at, organization_id")
    .in("venue_rental_id", rentalIds)

  if (input.organizationId) {
    reservationQuery = reservationQuery.eq(
      "organization_id",
      input.organizationId
    )
  }

  const { data: reservations, error: reservationError } = await reservationQuery

  if (reservationError) {
    throw new Error(
      reservationError.message ||
        "Failed to load reservations for auto-complete"
    )
  }

  const latestEndByRental = new Map<string, string>()
  for (const reservation of reservations || []) {
    const rentalId = reservation.venue_rental_id as string
    const endAt = reservation.end_at as string
    const previous = latestEndByRental.get(rentalId)
    if (!previous || new Date(endAt).getTime() > new Date(previous).getTime()) {
      latestEndByRental.set(rentalId, endAt)
    }
  }

  const candidates: VenueRentalEndCandidate[] = rentalRows
    .map((row) => {
      const latestEndAt = latestEndByRental.get(row.id)
      if (!latestEndAt) return null
      return {
        id: row.id,
        organization_id: row.organization_id,
        status: row.status,
        latestEndAt,
      }
    })
    .filter((row): row is VenueRentalEndCandidate => row !== null)

  const pastRentals = selectPastEventRentals(candidates, now)

  if (!pastRentals.length) {
    return {
      completedCount: 0,
      completedRentalIds: [],
      completedByOrganization: {},
    }
  }

  const completedByOrganization = groupVenueRentalIdsByOrganization(pastRentals)
  const appliedByOrganization: Record<string, string[]> = {}
  const appliedRentalIds: string[] = []

  for (const [organizationId, rentalIdsToComplete] of Object.entries(
    completedByOrganization
  )) {
    const { error: updateError, data: updatedRentals } = await input.supabase
      .from("venue_rentals")
      .update({ status: VENUE_RENTAL_STATUSES.completed })
      .in("id", rentalIdsToComplete)
      .eq("organization_id", organizationId)
      .in("status", VENUE_RENTAL_AUTO_COMPLETE_STATUSES)
      .select("id")

    if (updateError) {
      throw new Error(
        updateError.message ||
          `Failed to auto-complete venue rentals for organization ${organizationId}`
      )
    }

    const updatedIds = (updatedRentals || []).map((row) => row.id as string)
    if (!updatedIds.length) continue

    appliedByOrganization[organizationId] = updatedIds
    appliedRentalIds.push(...updatedIds)
  }

  return {
    completedCount: appliedRentalIds.length,
    completedRentalIds: appliedRentalIds,
    completedByOrganization: appliedByOrganization,
  }
}

export type VenueRentalAutoCompleteJobResult = {
  ranAt: string
  completedCount: number
  organizationsAffected: number
  completedByOrganization: Record<string, string[]>
}

/** Platform cron entry point — processes all organizations via service role. */
export async function runVenueRentalAutoCompleteJob(input?: {
  asOf?: Date
}): Promise<VenueRentalAutoCompleteJobResult> {
  const supabase = createServiceRoleClient()
  const asOf = input?.asOf ?? new Date()

  const result = await completePastConfirmedVenueRentalsForScope({
    supabase,
    now: asOf,
  })

  if (result.completedCount > 0) {
    console.info("venue-rental-auto-complete job completed rentals", {
      ranAt: asOf.toISOString(),
      completedCount: result.completedCount,
      completedByOrganization: result.completedByOrganization,
    })
  }

  return {
    ranAt: asOf.toISOString(),
    completedCount: result.completedCount,
    organizationsAffected: Object.keys(result.completedByOrganization).length,
    completedByOrganization: result.completedByOrganization,
  }
}

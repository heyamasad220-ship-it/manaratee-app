import type { SupabaseClient } from "@supabase/supabase-js"

import { isHoldExpired } from "./venue-rental-status"
import {
  RENTAL_RESERVATION_STATUSES,
  VENUE_RENTAL_STATUSES,
  type VenueRentalStatus,
} from "./venue-rental-types"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

/** Rentals awaiting deposit that may expire when hold_expires_at passes. */
export const VENUE_RENTAL_HOLD_PAYMENT_STATUSES: VenueRentalStatus[] = [
  VENUE_RENTAL_STATUSES.approvedPendingPayment,
  // Legacy partial-payment statuses (pre deposit→confirmed process)
  VENUE_RENTAL_STATUSES.depositPaid,
  VENUE_RENTAL_STATUSES.securityDepositPaid,
]

/**
 * Submitted/pending request holds (72h from submit) plus unpaid payment holds.
 * When hold_expires_at elapses → hold_expired and calendar release.
 */
export const VENUE_RENTAL_EXPIRABLE_HOLD_STATUSES: VenueRentalStatus[] = [
  VENUE_RENTAL_STATUSES.submitted,
  VENUE_RENTAL_STATUSES.pending,
  VENUE_RENTAL_STATUSES.awaitingSupervisorApproval,
  ...VENUE_RENTAL_HOLD_PAYMENT_STATUSES,
]

export type VenueRentalHoldCandidate = {
  id: string
  organization_id: string
  hold_expires_at: string | null
  status: string
}

export type ExpireVenueRentalHoldsResult = {
  expiredCount: number
  expiredRentalIds: string[]
  expiredByOrganization: Record<string, string[]>
}

export function selectExpiredHoldRentals(
  rentals: VenueRentalHoldCandidate[],
  now: Date = new Date()
): VenueRentalHoldCandidate[] {
  const holdStatuses = new Set<string>(VENUE_RENTAL_EXPIRABLE_HOLD_STATUSES)

  return rentals.filter((rental) => {
    if (!holdStatuses.has(rental.status)) {
      return false
    }

    return isHoldExpired(rental.hold_expires_at, now)
  })
}

export function groupVenueRentalIdsByOrganization(
  rentals: VenueRentalHoldCandidate[]
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
 * Expire temporary holds within an optional single-organization scope.
 * Idempotent: only updates rentals still in expirable hold statuses with elapsed hold_expires_at.
 */
export async function expireVenueRentalHoldsForScope(input: {
  supabase: SupabaseClient
  organizationId?: string
  now?: Date
}): Promise<ExpireVenueRentalHoldsResult> {
  const now = input.now ?? new Date()
  const nowIso = now.toISOString()

  let query = input.supabase
    .from("venue_rentals")
    .select("id, organization_id, hold_expires_at, status")
    .in("status", VENUE_RENTAL_EXPIRABLE_HOLD_STATUSES)
    .not("hold_expires_at", "is", null)
    .lte("hold_expires_at", nowIso)

  if (input.organizationId) {
    query = query.eq("organization_id", input.organizationId)
  }

  const { data: rentals, error } = await query

  if (error) {
    throw new Error(error.message || "Failed to load rentals for hold expiration")
  }

  const expiredRentals = selectExpiredHoldRentals(
    (rentals || []) as VenueRentalHoldCandidate[],
    now
  )

  if (!expiredRentals.length) {
    return {
      expiredCount: 0,
      expiredRentalIds: [],
      expiredByOrganization: {},
    }
  }

  const expiredByOrganization = groupVenueRentalIdsByOrganization(expiredRentals)
  const appliedByOrganization: Record<string, string[]> = {}
  const appliedRentalIds: string[] = []

  for (const [organizationId, expiredIds] of Object.entries(expiredByOrganization)) {
    const { error: rentalUpdateError, data: updatedRentals } = await input.supabase
      .from("venue_rentals")
      .update({
        status: VENUE_RENTAL_STATUSES.holdExpired,
        hold_expires_at: null,
      })
      .in("id", expiredIds)
      .eq("organization_id", organizationId)
      .in("status", VENUE_RENTAL_EXPIRABLE_HOLD_STATUSES)
      .select("id")

    if (rentalUpdateError) {
      throw new Error(
        rentalUpdateError.message ||
          `Failed to expire venue rentals for organization ${organizationId}`
      )
    }

    const updatedIds = (updatedRentals || []).map((row) => row.id as string)

    if (!updatedIds.length) {
      continue
    }

    const { error: reservationUpdateError } = await input.supabase
      .from("rental_reservations")
      .update({
        status: RENTAL_RESERVATION_STATUSES.expired,
        hold_expires_at: null,
      })
      .in("venue_rental_id", updatedIds)
      .eq("organization_id", organizationId)

    if (reservationUpdateError) {
      throw new Error(
        reservationUpdateError.message ||
          `Failed to expire rental reservations for organization ${organizationId}`
      )
    }

    appliedByOrganization[organizationId] = updatedIds
    appliedRentalIds.push(...updatedIds)
  }

  return {
    expiredCount: appliedRentalIds.length,
    expiredRentalIds: appliedRentalIds,
    expiredByOrganization: appliedByOrganization,
  }
}

export type VenueRentalHoldExpiryJobResult = {
  ranAt: string
  expiredCount: number
  organizationsAffected: number
  expiredByOrganization: Record<string, string[]>
}

/** Platform cron entry point — processes all organizations via service role. */
export async function runVenueRentalHoldExpiryJob(input?: {
  asOf?: Date
}): Promise<VenueRentalHoldExpiryJobResult> {
  const supabase = createServiceRoleClient()
  const asOf = input?.asOf ?? new Date()

  const result = await expireVenueRentalHoldsForScope({
    supabase,
    now: asOf,
  })

  if (result.expiredCount > 0) {
    console.info("venue-rental-hold-expiry job expired holds", {
      ranAt: asOf.toISOString(),
      expiredCount: result.expiredCount,
      expiredByOrganization: result.expiredByOrganization,
    })
  }

  return {
    ranAt: asOf.toISOString(),
    expiredCount: result.expiredCount,
    organizationsAffected: Object.keys(result.expiredByOrganization).length,
    expiredByOrganization: result.expiredByOrganization,
  }
}

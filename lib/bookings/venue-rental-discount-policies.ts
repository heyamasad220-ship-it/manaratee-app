/**
 * Apply optional Venue Rentals Settings discount policies to a space fee.
 * Matching policies: multi-venue and/or contact discount tag.
 * When several match, the largest dollar savings wins (no stacking).
 */

export const VENUE_RENTAL_DISCOUNT_TYPES = {
  fixed: "fixed",
  percent: "percent",
} as const

export type VenueRentalDiscountType =
  (typeof VENUE_RENTAL_DISCOUNT_TYPES)[keyof typeof VENUE_RENTAL_DISCOUNT_TYPES]

export type VenueRentalDiscountPolicyRule = {
  id: string
  name: string
  discountType: VenueRentalDiscountType
  amount: number
  requiresMultiVenue: boolean
  minVenues: number
  discountTagId: string | null
  isActive: boolean
}

export type AppliedVenueRentalDiscount = {
  policyId: string
  policyName: string
  discountAmount: number
}

export type VenueRentalDiscountApplication = {
  spaceFee: number
  discountAmount: number
  totalCharges: number
  applied: AppliedVenueRentalDiscount | null
}

export function computeVenueRentalPolicyDiscountAmount(
  spaceFee: number,
  policy: Pick<VenueRentalDiscountPolicyRule, "discountType" | "amount">
): number {
  const fee = Math.max(0, Number(spaceFee) || 0)
  const amount = Math.max(0, Number(policy.amount) || 0)
  if (fee <= 0 || amount <= 0) return 0

  if (policy.discountType === VENUE_RENTAL_DISCOUNT_TYPES.percent) {
    const percent = Math.min(100, amount)
    return Math.round(((fee * percent) / 100) * 100) / 100
  }

  return Math.min(fee, Math.round(amount * 100) / 100)
}

export function venueRentalDiscountPolicyMatches(input: {
  policy: VenueRentalDiscountPolicyRule
  venueCount: number
  contactTagIds: string[]
}): boolean {
  const { policy, venueCount, contactTagIds } = input
  if (!policy.isActive) return false

  const hasMulti = policy.requiresMultiVenue
  const hasTag = Boolean(policy.discountTagId)

  // Catalog-only rows (no conditions) do not auto-apply.
  if (!hasMulti && !hasTag) return false

  if (hasMulti && venueCount < Math.max(2, policy.minVenues || 2)) {
    return false
  }

  if (hasTag && !contactTagIds.includes(policy.discountTagId as string)) {
    return false
  }

  return true
}

/** Apply the single best matching policy (max dollar savings). */
export function applyVenueRentalDiscountPolicies(input: {
  spaceFee: number
  venueCount: number
  contactTagIds: string[]
  policies: VenueRentalDiscountPolicyRule[]
}): VenueRentalDiscountApplication {
  const spaceFee = Math.max(0, Math.round(Number(input.spaceFee) * 100) / 100)
  let best: AppliedVenueRentalDiscount | null = null

  for (const policy of input.policies) {
    if (
      !venueRentalDiscountPolicyMatches({
        policy,
        venueCount: input.venueCount,
        contactTagIds: input.contactTagIds,
      })
    ) {
      continue
    }

    const discountAmount = computeVenueRentalPolicyDiscountAmount(
      spaceFee,
      policy
    )
    if (discountAmount <= 0) continue

    if (!best || discountAmount > best.discountAmount) {
      best = {
        policyId: policy.id,
        policyName: policy.name,
        discountAmount,
      }
    }
  }

  const discountAmount = best?.discountAmount ?? 0
  const totalCharges = Math.max(
    0,
    Math.round((spaceFee - discountAmount) * 100) / 100
  )

  return {
    spaceFee,
    discountAmount,
    totalCharges,
    applied: best,
  }
}

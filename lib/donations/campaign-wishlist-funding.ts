import {
  type WishlistFundingStatus,
  type WishlistFundingTotals,
} from "@/lib/donations/campaign-wishlist-types"
import { countsTowardGivingTotals, paymentNetAmount } from "@/lib/donations/payment-net-amount"

export function deriveWishlistFundingStatus(
  lifetimeCollected: number,
  targetAmount: number
): WishlistFundingStatus {
  if (lifetimeCollected <= 0) return "not_funded"
  if (targetAmount > 0 && lifetimeCollected > targetAmount) return "overfunded"
  if (targetAmount > 0 && lifetimeCollected >= targetAmount) return "fully_funded"
  if (lifetimeCollected > 0) return "partially_funded"
  return "not_funded"
}

/**
 * Wishlist funding: pledged/collected are current-campaign amounts only.
 * previousFunding is historical (carry-forward snapshot) and is never added to
 * the destination campaign's raised total.
 */
export function computeWishlistFunding(input: {
  targetAmount: number
  previousFundingAmount?: number
  pledged: number
  collected: number
}): WishlistFundingTotals {
  const target = Math.max(Number(input.targetAmount || 0), 0)
  const previousFunding = Math.max(Number(input.previousFundingAmount || 0), 0)
  const pledged = Math.max(Number(input.pledged || 0), 0)
  const collected = Math.max(Number(input.collected || 0), 0)
  const lifetimeCollected = previousFunding + collected
  const remaining = Math.max(target - lifetimeCollected, 0)
  const fundingPercent = target > 0 ? Math.min((lifetimeCollected / target) * 100, 999) : null

  return {
    pledged,
    collected,
    previousFunding,
    lifetimeCollected,
    remaining,
    fundingPercent,
    fundingStatus: deriveWishlistFundingStatus(lifetimeCollected, target),
  }
}

export function wishlistPaymentNet(payment: {
  amount?: number | null
  refunded_amount?: number | null
  status?: string | null
}) {
  if (
    !countsTowardGivingTotals({
      amount: payment.amount,
      refunded_amount: payment.refunded_amount,
      status: payment.status,
    })
  ) {
    return 0
  }
  return paymentNetAmount(payment.amount, payment.refunded_amount)
}

export function isOpenWishlistPledgeStatus(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase()
  return normalized !== "cancelled" && normalized !== "canceled"
}

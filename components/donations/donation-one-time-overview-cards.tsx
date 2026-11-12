"use client"

import { AlertCircle, DollarSign, TrendingUp, Users } from "lucide-react"

import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import type { DonationTransactionsSummary } from "@/lib/donations/donation-list-actions"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"

export function DonationOneTimeOverviewCards({
  loading,
  summary,
  needsReviewActive = false,
  onNeedsReviewClick,
}: {
  loading: boolean
  summary: DonationTransactionsSummary | null
  needsReviewActive?: boolean
  onNeedsReviewClick?: () => void
}) {
  if (loading && !summary) {
    return <p className="text-sm text-muted-foreground">Loading overview...</p>
  }

  const metrics = summary ?? {
    totalCollected: 0,
    paymentCount: 0,
    averageGift: 0,
    largestGift: 0,
    donorCount: 0,
    needsAttentionCount: 0,
  }

  return (
    <DonationMetricCardGrid colorful columns={4}>
      <DonationMetricCard
        title="Total Collected"
        value={formatDonationCurrency(metrics.totalCollected)}
        icon={DollarSign}
        accent="blue"
        description={`${metrics.paymentCount} gifts · avg ${formatDonationCurrency(metrics.averageGift)}`}
      />
      <DonationMetricCard
        title="Transactions"
        value={metrics.paymentCount}
        icon={TrendingUp}
        accent="purple"
      />
      <DonationMetricCard
        title="Donors"
        value={metrics.donorCount}
        icon={Users}
        accent="emerald"
      />
      <DonationMetricCard
        title="Needs review"
        value={metrics.needsAttentionCount}
        icon={AlertCircle}
        accent="amber"
        description="Unmatched imports and voided gifts"
        onClick={onNeedsReviewClick}
        className={needsReviewActive ? "ring-2 ring-amber-400" : undefined}
      />
    </DonationMetricCardGrid>
  )
}

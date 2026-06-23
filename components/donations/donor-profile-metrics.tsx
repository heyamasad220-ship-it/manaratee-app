"use client"

import { useEffect, useState } from "react"
import { Calendar, DollarSign, Heart, TrendingUp } from "lucide-react"
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { getDonorGivingTotalsAction } from "@/lib/donations/receipt-actions"
import type { DonorGivingTotals } from "@/lib/donations/receipt-types"

type DonorProfileMetricsProps = {
  donorId: string
  totalDonations: number
  donationCount: number
  lastDonation: string | null
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount)
}

export function DonorProfileMetrics({
  donorId,
  totalDonations,
  donationCount,
  lastDonation,
}: DonorProfileMetricsProps) {
  const [totals, setTotals] = useState<DonorGivingTotals | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const result = await getDonorGivingTotalsAction(donorId)
      if (result.success) setTotals(result.totals)
      setLoading(false)
    }
    load()
  }, [donorId])

  const averageDonation =
    donationCount > 0 ? Math.round(totalDonations / donationCount) : 0

  return (
    <DonationMetricCardGrid colorful className="mb-6">
      <DonationMetricCard
        title="Total Donations"
        value={formatCurrency(totalDonations)}
        icon={DollarSign}
        accent="blue"
        description="All-time contributions"
      />
      <DonationMetricCard
        title="Donation Count"
        value={donationCount}
        icon={Heart}
        accent="emerald"
        description="Total donations made"
      />
      <DonationMetricCard
        title="Average Donation"
        value={formatCurrency(averageDonation)}
        icon={TrendingUp}
        accent="amber"
        description="Per donation"
      />
      <DonationMetricCard
        title="Last Donation"
        value={
          lastDonation
            ? new Date(lastDonation).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "N/A"
        }
        icon={Calendar}
        accent="purple"
        description={lastDonation ? String(new Date(lastDonation).getFullYear()) : ""}
      />
      <DonationMetricCard
        title="Lifetime Giving"
        value={loading ? "—" : formatCurrency(totals?.lifetimeGiving ?? 0)}
        icon={DollarSign}
        accent="violet"
        description="All actual payments"
      />
      <DonationMetricCard
        title={loading ? "Current Year Giving" : `${totals?.currentYear ?? new Date().getFullYear()} Giving`}
        value={loading ? "—" : formatCurrency(totals?.currentYearGiving ?? 0)}
        icon={Calendar}
        accent="rose"
        description="Current calendar year"
      />
      <DonationMetricCard
        title={loading ? "Prior Year Giving" : `${totals?.previousYear ?? new Date().getFullYear() - 1} Giving`}
        value={loading ? "—" : formatCurrency(totals?.previousYearGiving ?? 0)}
        icon={TrendingUp}
        accent="cyan"
        description="Prior calendar year"
      />
    </DonationMetricCardGrid>
  )
}

"use client"

import { useEffect, useState } from "react"
import { Calendar, DollarSign, Heart, Mail } from "lucide-react"
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import {
  getDonorPledgeCollectionSummaryAction,
  getDonorPledgesAction,
} from "@/lib/donations/pledge-reminder-actions"

type DonorProfileMetricsProps = {
  donorId: string
  totalDonations: number
  donationCount: number
  lastDonation: string | null
  onDonationCountClick?: () => void
  onPledgesClick?: () => void
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function DonorProfileMetrics({
  donorId,
  totalDonations,
  donationCount,
  lastDonation,
  onDonationCountClick,
  onPledgesClick,
}: DonorProfileMetricsProps) {
  const [pledgeLoading, setPledgeLoading] = useState(true)
  const [pledgeCount, setPledgeCount] = useState(0)
  const [outstandingBalance, setOutstandingBalance] = useState(0)
  const [lastReminderAt, setLastReminderAt] = useState<string | null>(null)
  const [lastContactedAt, setLastContactedAt] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setPledgeLoading(true)
      const [summaryResult, pledgesResult] = await Promise.all([
        getDonorPledgeCollectionSummaryAction(donorId),
        getDonorPledgesAction(donorId),
      ])

      if (summaryResult.success) {
        setOutstandingBalance(summaryResult.summary.outstandingBalance)
        setLastReminderAt(summaryResult.summary.lastReminderAt)
        setLastContactedAt(summaryResult.summary.lastContactedAt)
      }

      if (pledgesResult.success) {
        setPledgeCount(pledgesResult.pledges.length)
      }

      setPledgeLoading(false)
    }
    void load()
  }, [donorId])

  return (
    <DonationMetricCardGrid colorful columns={3} className="mb-6">
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
        description="Click to view history"
        onValueClick={onDonationCountClick}
      />
      <DonationMetricCard
        title="Last Donation"
        value={
          lastDonation
            ? new Date(lastDonation).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "—"
        }
        icon={Calendar}
        accent="purple"
        description={lastDonation ? "Most recent gift" : "No gifts yet"}
      />
      <DonationMetricCard
        title="Pledges"
        value={pledgeLoading ? "—" : pledgeCount}
        icon={Heart}
        accent="violet"
        description="Click to view pledges"
        onValueClick={onPledgesClick}
      />
      <DonationMetricCard
        title="Outstanding Balance"
        value={pledgeLoading ? "—" : formatCurrency(outstandingBalance)}
        icon={DollarSign}
        accent="amber"
        description="Yet to be collected"
      />
      <DonationMetricCard
        title="Last Reminder"
        value={pledgeLoading ? "—" : formatDate(lastReminderAt)}
        icon={Mail}
        accent="rose"
        description={
          pledgeLoading ? "" : `Last contacted: ${formatDate(lastContactedAt)}`
        }
      />
    </DonationMetricCardGrid>
  )
}

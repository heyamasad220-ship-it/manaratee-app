import { AlertCircle, ArrowUpRight, CheckCircle2, DollarSign, Heart } from "lucide-react"

import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"

export type PledgeSummaryMetrics = {
  totalPledged: number
  totalCollected: number
  outstandingBalance: number
  activePledgeCount: number
  fulfilledPledgeCount?: number
  pledgeCount: number
}

type PledgeSummaryMetricCardsProps = {
  metrics: PledgeSummaryMetrics
  className?: string
  statusFilter?: string
  overdueCount?: number
  /** Three cards for every non-cancelled pledge in scope, ignoring the table status filter. */
  variant?: "default" | "campaign"
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function getPledgeCountLabel(statusFilter?: string) {
  switch (statusFilter) {
    case "Open":
      return "open pledges"
    case "Fulfilled":
      return "fulfilled pledges"
    default:
      return "pledges"
  }
}

function getActivePledgeCardLabels(statusFilter?: string) {
  switch (statusFilter) {
    case "Open":
      return { title: "Open Pledges", description: "Outstanding balance" }
    case "Fulfilled":
      return { title: "Fulfilled Pledges", description: "Matching current filters" }
    default:
      return { title: "Active Pledges", description: "Not yet fulfilled" }
  }
}

export function PledgeSummaryMetricCards({
  metrics,
  className,
  statusFilter = "all",
  overdueCount,
  variant = "default",
}: PledgeSummaryMetricCardsProps) {
  const { totalPledged, totalCollected, outstandingBalance, activePledgeCount, pledgeCount } =
    metrics

  if (variant === "campaign") {
    const fulfilledPledgeCount = metrics.fulfilledPledgeCount ?? 0
    return (
      <DonationMetricCardGrid colorful columns={3} className={className}>
        <DonationMetricCard
          title="Total Pledged"
          value={formatDonationCurrency(totalPledged)}
          icon={Heart}
          accent="blue"
          description={countLabel(pledgeCount, "pledge")}
        />
        <DonationMetricCard
          title="Collected"
          value={formatDonationCurrency(totalCollected)}
          icon={DollarSign}
          accent="emerald"
          description={countLabel(fulfilledPledgeCount, "paid in full", "paid in full")}
        />
        <DonationMetricCard
          title="Remaining"
          value={formatDonationCurrency(outstandingBalance)}
          icon={AlertCircle}
          accent="amber"
          description={countLabel(activePledgeCount, "open pledge")}
        />
      </DonationMetricCardGrid>
    )
  }
  const activeCard = getActivePledgeCardLabels(statusFilter === "all" ? undefined : statusFilter)
  const pledgeLabel = getPledgeCountLabel(statusFilter === "all" ? undefined : statusFilter)
  const remainingDescription =
    overdueCount != null && overdueCount > 0
      ? `${overdueCount} overdue`
      : "Yet to be collected"

  return (
    <DonationMetricCardGrid colorful className={className}>
      <DonationMetricCard
        title="Total Pledged"
        value={formatDonationCurrency(totalPledged)}
        icon={Heart}
        accent="blue"
        description={`Across ${pledgeCount} ${pledgeLabel}`}
      />
      <DonationMetricCard
        title="Collected"
        value={formatDonationCurrency(totalCollected)}
        icon={DollarSign}
        accent="emerald"
        description={
          <span className="inline-flex items-center">
            <ArrowUpRight className="mr-1 h-3 w-3" />
            {totalPledged > 0 ? Math.round((totalCollected / totalPledged) * 100) : 0}% of total
          </span>
        }
      />
      <DonationMetricCard
        title="Remaining"
        value={formatDonationCurrency(outstandingBalance)}
        icon={AlertCircle}
        accent="amber"
        description={remainingDescription}
      />
      <DonationMetricCard
        title={activeCard.title}
        value={activePledgeCount}
        icon={CheckCircle2}
        accent="violet"
        description={activeCard.description}
      />
    </DonationMetricCardGrid>
  )
}

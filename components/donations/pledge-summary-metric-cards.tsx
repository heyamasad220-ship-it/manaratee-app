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
  pledgeCount: number
}

type PledgeSummaryMetricCardsProps = {
  metrics: PledgeSummaryMetrics
  className?: string
  statusFilter?: string
}

function getPledgeCountLabel(statusFilter?: string) {
  switch (statusFilter) {
    case "Open":
      return "open pledges"
    case "Partial":
      return "partial pledges"
    case "Fulfilled":
      return "fulfilled pledges"
    default:
      return "pledges"
  }
}

function getActivePledgeCardLabels(statusFilter?: string) {
  switch (statusFilter) {
    case "Open":
      return { title: "Open Pledges", description: "Matching current filters" }
    case "Partial":
      return { title: "Partial Pledges", description: "Matching current filters" }
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
}: PledgeSummaryMetricCardsProps) {
  const { totalPledged, totalCollected, outstandingBalance, activePledgeCount, pledgeCount } =
    metrics
  const activeCard = getActivePledgeCardLabels(statusFilter === "all" ? undefined : statusFilter)
  const pledgeLabel = getPledgeCountLabel(statusFilter === "all" ? undefined : statusFilter)

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
        description="Yet to be collected"
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

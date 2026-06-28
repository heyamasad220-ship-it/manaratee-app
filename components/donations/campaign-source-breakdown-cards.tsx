import type { ReactNode } from "react"
import {
  Banknote,
  CreditCard,
  Heart,
  RefreshCw,
  ScanLine,
  Settings2,
  Ticket,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import {
  ACCENT_STYLES,
  type DonationMetricAccent,
} from "@/components/donations/donation-metric-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import {
  formatDonationCurrency,
  type CampaignDonorInsights,
  type CampaignMetrics,
  type CampaignSourceBreakdown,
} from "@/lib/donations/campaign-analytics"
import {
  resolveCampaignOverviewMetricKeys,
  type CampaignOverviewMetricKey,
} from "@/lib/donations/campaign-overview-metrics"
import { cn } from "@/lib/utils"

type MetricTableRow = {
  key: CampaignOverviewMetricKey
  title: string
  value: ReactNode
  icon: LucideIcon
  accent: DonationMetricAccent
  description?: ReactNode
  highlight?: boolean
  onValueClick?: () => void
}

type CampaignOverviewMetricsTableProps = {
  breakdown: CampaignSourceBreakdown
  metrics: CampaignMetrics
  insights: CampaignDonorInsights | null
  visibleMetricKeys?: CampaignOverviewMetricKey[] | null
  canCustomize?: boolean
  onCustomizeClick?: () => void
  onDonorsClick?: () => void
  onLargestGiftClick?: () => void
}

function MetricTableRowCell({
  row,
}: {
  row: MetricTableRow
}) {
  const styles = ACCENT_STYLES[row.accent]
  const valueClassName = cn(
    "text-right text-xl font-bold tabular-nums",
    row.highlight && "text-2xl",
    styles.value,
    row.onValueClick && "cursor-pointer transition hover:underline"
  )

  return (
    <TableRow
      className={cn(
        "hover:bg-muted/30",
        styles.card,
        row.highlight && "bg-rose-50/70 dark:bg-rose-950/20"
      )}
    >
      <TableCell className="w-14 py-3">
        <div className={cn(styles.iconWrap, "inline-flex")}>
          <row.icon className={cn("h-5 w-5", styles.icon)} />
        </div>
      </TableCell>
      <TableCell className="py-3">
        <p className={cn("font-medium text-muted-foreground", row.highlight && "text-foreground")}>
          {row.title}
        </p>
        {row.description ? (
          <div className="mt-0.5 text-xs text-muted-foreground">{row.description}</div>
        ) : null}
      </TableCell>
      <TableCell className="py-3">
        {row.onValueClick ? (
          <button type="button" onClick={row.onValueClick} className={cn(valueClassName, "ml-auto block")}>
            {row.value}
          </button>
        ) : (
          <div className={cn(valueClassName, "ml-auto")}>{row.value}</div>
        )}
      </TableCell>
    </TableRow>
  )
}

function buildCampaignOverviewMetricRows(input: {
  breakdown: CampaignSourceBreakdown
  metrics: CampaignMetrics
  insights: CampaignDonorInsights | null
  onDonorsClick?: () => void
  onLargestGiftClick?: () => void
}): MetricTableRow[] {
  const { breakdown, metrics, insights, onDonorsClick, onLargestGiftClick } = input
  const largestGift = insights?.largestGift
  const largestGiftAmount = formatDonationCurrency(largestGift?.amount ?? metrics.largestGift)
  const largestGiftDonorLabel =
    largestGift?.displayName && (largestGift?.amount ?? metrics.largestGift) > 0
      ? `From ${largestGift.displayName}`
      : undefined

  return [
    { key: "cash", title: "Cash", value: formatDonationCurrency(breakdown.cash), icon: Banknote, accent: "emerald" },
    { key: "checks", title: "Checks", value: formatDonationCurrency(breakdown.checks), icon: Wallet, accent: "blue" },
    {
      key: "square",
      title: "Square",
      value: formatDonationCurrency(breakdown.square),
      icon: ScanLine,
      accent: "amber",
    },
    {
      key: "one-time",
      title: "One-Time Donations",
      value: formatDonationCurrency(breakdown.ccOneTime),
      icon: CreditCard,
      accent: "purple",
    },
    {
      key: "recurring",
      title: "Recurring Donations",
      value: formatDonationCurrency(breakdown.ccRecurring),
      icon: RefreshCw,
      accent: "violet",
    },
    {
      key: "ticket-sales",
      title: "Ticket Sales",
      value: formatDonationCurrency(breakdown.ticketSales),
      icon: Ticket,
      accent: "cyan",
    },
    {
      key: "other",
      title: "Other",
      value: formatDonationCurrency(breakdown.other),
      icon: TrendingUp,
      accent: "amber",
    },
    {
      key: "donors",
      title: "Donors",
      value: metrics.donorCount,
      icon: Users,
      accent: "cyan",
      onValueClick: onDonorsClick,
    },
    {
      key: "largest-gift",
      title: "Largest Gift",
      value: onLargestGiftClick ? (
        <button
          type="button"
          onClick={onLargestGiftClick}
          className="cursor-pointer transition hover:underline"
        >
          {largestGiftAmount}
        </button>
      ) : (
        largestGiftAmount
      ),
      icon: TrendingUp,
      accent: "rose",
      description:
        largestGiftDonorLabel && onLargestGiftClick ? (
          <button
            type="button"
            onClick={onLargestGiftClick}
            className="cursor-pointer transition hover:underline"
          >
            {largestGiftDonorLabel}
          </button>
        ) : (
          largestGiftDonorLabel
        ),
    },
    {
      key: "pledges",
      title: "Pledges",
      value: formatDonationCurrency(breakdown.remainingPledges),
      icon: Heart,
      accent: "rose",
      highlight: true,
      description: (
        <>
          Outstanding pledge balance · Total pledged {formatDonationCurrency(metrics.pledged)} · Collected{" "}
          {formatDonationCurrency(metrics.collectedAgainstPledges)}
        </>
      ),
    },
  ]
}

export function CampaignOverviewMetricsTable({
  breakdown,
  metrics,
  insights,
  visibleMetricKeys,
  canCustomize = false,
  onCustomizeClick,
  onDonorsClick,
  onLargestGiftClick,
}: CampaignOverviewMetricsTableProps) {
  const resolvedKeys = resolveCampaignOverviewMetricKeys({
    savedKeys: visibleMetricKeys ?? null,
    breakdown,
  })
  const rowByKey = new Map(
    buildCampaignOverviewMetricRows({
      breakdown,
      metrics,
      insights,
      onDonorsClick,
      onLargestGiftClick,
    }).map((row) => [row.key, row])
  )
  const rows = resolvedKeys
    .map((key) => rowByKey.get(key))
    .filter((row): row is MetricTableRow => Boolean(row))

  return (
    <Card>
      {canCustomize ? (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3">
          <CardTitle className="text-base font-medium">Overview metrics</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={onCustomizeClick}>
            <Settings2 className="mr-2 h-4 w-4" />
            Customize
          </Button>
        </CardHeader>
      ) : null}
      <CardContent className={cn("p-0", canCustomize && "border-t")}>
        <Table>
          <TableBody>
            {rows.map((row) => (
              <MetricTableRowCell key={row.key} row={row} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

/** @deprecated Use CampaignOverviewMetricsTable */
export const CampaignSourceBreakdownCards = CampaignOverviewMetricsTable

import type { ReactNode } from "react"
import {
  AlertCircle,
  Banknote,
  CreditCard,
  DollarSign,
  Gift,
  Heart,
  Landmark,
  RefreshCw,
  ScanLine,
  Settings2,
  Target,
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
  campaignCommitmentRaised,
  formatDonationCurrency,
  type CampaignMetrics,
  type CampaignSourceBreakdown,
} from "@/lib/donations/campaign-analytics"
import {
  resolveCampaignOverviewMetricKeys,
  type CampaignOverviewMetricKey,
} from "@/lib/donations/campaign-overview-metrics"
import { cn } from "@/lib/utils"

type MetricTableRow = {
  key: string
  title: string
  value: ReactNode
  icon: LucideIcon
  accent: DonationMetricAccent
  description?: ReactNode
  highlight?: boolean
  onClick?: () => void
}

const PINNED_OVERVIEW_KEYS = new Set<CampaignOverviewMetricKey>(["donors", "largest-gift"])

type CampaignOverviewMetricsTableProps = {
  breakdown: CampaignSourceBreakdown
  metrics: CampaignMetrics
  goalAmount?: number | null
  visibleMetricKeys?: CampaignOverviewMetricKey[] | null
  canCustomize?: boolean
  onCustomizeClick?: () => void
  onMetricClick?: (key: string) => void
}

function MetricTableRowCell({
  row,
}: {
  row: MetricTableRow
}) {
  const styles = ACCENT_STYLES[row.accent]
  const clickable = Boolean(row.onClick)

  return (
    <TableRow
      className={cn(
        "hover:bg-muted/30",
        styles.card,
        row.highlight && "bg-rose-50/70 dark:bg-rose-950/20",
        clickable && "cursor-pointer"
      )}
      onClick={row.onClick}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                row.onClick?.()
              }
            }
          : undefined
      }
      tabIndex={clickable ? 0 : undefined}
      role={clickable ? "button" : undefined}
      aria-label={clickable ? `View ${row.title}` : undefined}
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
        <div className={cn("ml-auto text-right text-xl font-bold tabular-nums", row.highlight && "text-2xl", styles.value)}>
          {row.value}
        </div>
      </TableCell>
    </TableRow>
  )
}

function buildPinnedOverviewRows(input: {
  metrics: CampaignMetrics
  goalAmount?: number | null
  onMetricClick?: (key: string) => void
}): MetricTableRow[] {
  const { metrics, goalAmount, onMetricClick } = input
  const goal = goalAmount && goalAmount > 0 ? goalAmount : null
  const open = (key: string) => (onMetricClick ? () => onMetricClick(key) : undefined)

  return [
    {
      key: "goal",
      title: "Campaign Goal",
      value: goal != null ? formatDonationCurrency(goal) : "No goal set",
      icon: Target,
      accent: "blue",
    },
    {
      key: "total-raised",
      title: "Total Raised",
      value: formatDonationCurrency(campaignCommitmentRaised(metrics)),
      icon: TrendingUp,
      accent: "blue",
      description: "Collected plus open pledge balances",
      onClick: open("total-raised"),
    },
    {
      key: "total-collected",
      title: "Total Collected",
      value: formatDonationCurrency(metrics.raised),
      icon: DollarSign,
      accent: "emerald",
      description: "Every payment received",
      onClick: open("total-collected"),
    },
    {
      key: "outstanding",
      title: "Outstanding",
      value: formatDonationCurrency(metrics.outstanding),
      icon: AlertCircle,
      accent: "amber",
      description: "Open pledge balances",
      onClick: open("outstanding"),
    },
    {
      key: "donors",
      title: "Donors",
      value: metrics.donorCount,
      icon: Users,
      accent: "purple",
      description: "Unique donors",
      onClick: open("donors"),
    },
    {
      key: "largest-gift",
      title: "Largest Gift",
      value: formatDonationCurrency(metrics.largestGift),
      icon: Gift,
      accent: "rose",
      description: "Largest pledge or payment",
      onClick: open("largest-gift"),
    },
  ]
}

function buildCampaignOverviewMetricRows(input: {
  breakdown: CampaignSourceBreakdown
  metrics: CampaignMetrics
  onMetricClick?: (key: string) => void
}): MetricTableRow[] {
  const { breakdown, metrics, onMetricClick } = input
  const open = (key: string) => (onMetricClick ? () => onMetricClick(key) : undefined)

  return [
    { key: "cash", title: "Cash", value: formatDonationCurrency(breakdown.cash), icon: Banknote, accent: "emerald" },
    { key: "checks", title: "Checks", value: formatDonationCurrency(breakdown.checks), icon: Wallet, accent: "blue" },
    {
      key: "ach",
      title: "ACH",
      value: formatDonationCurrency(breakdown.ach),
      icon: Landmark,
      accent: "blue",
    },
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
  ].map((row) => ({ ...row, onClick: open(row.key) }))
}

export function CampaignOverviewMetricsTable({
  breakdown,
  metrics,
  goalAmount = null,
  visibleMetricKeys,
  canCustomize = false,
  onCustomizeClick,
  onMetricClick,
}: CampaignOverviewMetricsTableProps) {
  const resolvedKeys = resolveCampaignOverviewMetricKeys({
    savedKeys: visibleMetricKeys ?? null,
    breakdown,
  })
  const rowByKey = new Map(
    buildCampaignOverviewMetricRows({
      breakdown,
      metrics,
      onMetricClick,
    }).map((row) => [row.key, row])
  )
  const rows = [
    ...buildPinnedOverviewRows({ metrics, goalAmount, onMetricClick }),
    ...resolvedKeys
      .filter((key) => !PINNED_OVERVIEW_KEYS.has(key))
      .map((key) => rowByKey.get(key))
      .filter((row): row is MetricTableRow => Boolean(row)),
  ]

  return (
    <Card className="h-full">
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

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowUpRight,
  ChevronRight,
  DollarSign,
  FileUp,
  HandCoins,
  Loader2,
  Target,
  Wallet,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CampaignProgressBar } from "@/components/donations/campaign-progress-bar"
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import {
  getDonationOverviewDashboardAction,
  type DonationOverviewPayload,
} from "@/lib/donations/donation-overview-actions"
import { donationPledgesHref } from "@/lib/donations/donation-pledge-paths"

const QUICK_ACTIONS = [
  {
    label: "Receive Payment",
    href: "/donations/reports/one-time",
    icon: DollarSign,
  },
  {
    label: "Add Pledge",
    href: donationPledgesHref({ action: "add" }),
    icon: HandCoins,
  },
  {
    label: "Import Payments",
    href: "/donations/reports/import",
    icon: FileUp,
  },
  {
    label: "Create Campaign",
    href: "/donations/campaigns",
    icon: Target,
  },
] as const

export function DonationsOverviewDashboard() {
  const [data, setData] = useState<DonationOverviewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setErrorMessage(null)

      const result = await getDonationOverviewDashboardAction()
      if (!result.success) {
        setErrorMessage(result.error)
        setData(null)
      } else {
        setData(result.data)
      }

      setLoading(false)
    })()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading dashboard...
      </div>
    )
  }

  if (errorMessage) {
    return <p className="text-sm text-destructive">{errorMessage}</p>
  }

  if (!data) {
    return null
  }

  const { summary, actionItems, activeCampaigns } = data
  const totalPledged = summary.totalPledged
  const outstandingBalance = summary.outstandingBalance

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Dashboard Overview</h2>
        <p className="text-sm text-muted-foreground">
          Fundraising performance, items needing attention, and next steps
        </p>
      </div>

      <DonationMetricCardGrid colorful className="lg:grid-cols-4">
        <DonationMetricCard
          title="Active Campaigns"
          value={summary.activeCampaignCount}
          icon={Target}
          accent="blue"
          description="Fundraising campaigns in progress"
        />
        <DonationMetricCard
          title="Total Collected"
          value={formatDonationCurrency(summary.totalCollected)}
          icon={DollarSign}
          accent="emerald"
          description={
            <span className="inline-flex items-center">
              <ArrowUpRight className="mr-1 h-3 w-3" />
              {summary.paymentCount} transactions
            </span>
          }
        />
        <DonationMetricCard
          title="Outstanding Balance"
          value={formatDonationCurrency(outstandingBalance)}
          icon={AlertCircle}
          accent="amber"
          description={
            totalPledged > 0
              ? `${((outstandingBalance / totalPledged) * 100).toFixed(0)}% of pledges unpaid`
              : "No pledges yet"
          }
        />
        <DonationMetricCard
          title="Payments This Month"
          value={formatDonationCurrency(summary.thisMonthCollected)}
          icon={Wallet}
          accent="purple"
          description="Current calendar month"
        />
      </DonationMetricCardGrid>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Action Required</CardTitle>
            <CardDescription>Operational items that need staff attention</CardDescription>
          </CardHeader>
          <CardContent>
            {actionItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No donation actions need attention right now.
              </p>
            ) : (
              <ul className="space-y-2">
                {actionItems.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm transition hover:bg-muted/50"
                    >
                      <span>{item.label}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">Active Campaigns</CardTitle>
              <CardDescription>Live fundraising progress</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/donations/campaigns">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {activeCampaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active campaigns.</p>
            ) : (
              <ul className="space-y-4">
                {activeCampaigns.slice(0, 6).map((campaign) => (
                  <li key={campaign.id} className="space-y-2 rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/donations/campaigns/${campaign.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {campaign.name}
                      </Link>
                      <span className="whitespace-nowrap text-sm font-medium">
                        {formatDonationCurrency(campaign.raised)} raised
                      </span>
                    </div>
                    <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <span>
                        Goal:{" "}
                        {campaign.goalAmount != null
                          ? formatDonationCurrency(campaign.goalAmount)
                          : "—"}
                      </span>
                      <span>
                        Outstanding pledges: {formatDonationCurrency(campaign.outstandingPledgeBalance)}
                      </span>
                    </div>
                    <CampaignProgressBar progressPercent={campaign.progressPercent} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>Jump to common donation workflows</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid w-fit grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon
                return (
                  <Button
                    key={action.href}
                    className="h-auto w-[11.75rem] justify-start bg-primary px-4 py-3 text-primary-foreground hover:bg-primary/90"
                    asChild
                  >
                    <Link href={action.href}>
                      <Icon className="mr-2 h-4 w-4 shrink-0" />
                      {action.label}
                    </Link>
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

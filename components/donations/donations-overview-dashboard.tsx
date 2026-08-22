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
    href: "/donations/payments/transactions",
    icon: DollarSign,
  },
  {
    label: "Add Pledge",
    href: donationPledgesHref({ action: "add" }),
    icon: HandCoins,
  },
  {
    label: "Import Payments",
    href: "/donations/payments/import-match",
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
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Dashboard Overview</h2>
        <p className="text-sm text-muted-foreground">
          Fundraising performance, items needing attention, and next steps
        </p>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_13.5rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <DonationMetricCardGrid colorful compact className="lg:grid-cols-4">
            <DonationMetricCard
              compact
              title="Active Campaigns"
              value={summary.activeCampaignCount}
              icon={Target}
              accent="blue"
              description="Fundraising campaigns in progress"
            />
            <DonationMetricCard
              compact
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
              compact
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
              compact
              title="Payments This Month"
              value={formatDonationCurrency(summary.thisMonthCollected)}
              icon={Wallet}
              accent="purple"
              description="Current calendar month"
            />
          </DonationMetricCardGrid>

          <div className="grid flex-1 gap-4 md:grid-cols-2">
            <Card className="h-full">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">Action Required</CardTitle>
                <CardDescription className="text-xs">
                  Operational items that need staff attention
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                {actionItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No donation actions need attention right now.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {actionItems.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className="flex items-center justify-between gap-3 rounded-md border px-2.5 py-1.5 text-sm transition hover:bg-muted/50"
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

            <Card className="h-full">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-4 pb-2">
                <div>
                  <CardTitle className="text-sm">Active Campaigns</CardTitle>
                  <CardDescription className="text-xs">Live fundraising progress</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
                  <Link href="/donations/campaigns">View all</Link>
                </Button>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                {activeCampaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active campaigns.</p>
                ) : (
                  <ul className="space-y-2">
                    {activeCampaigns.slice(0, 4).map((campaign) => (
                      <li key={campaign.id} className="space-y-1.5 rounded-md border p-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <Link
                            href={`/donations/campaigns/${campaign.id}`}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            {campaign.name}
                          </Link>
                          <span className="whitespace-nowrap text-xs font-medium">
                            {formatDonationCurrency(campaign.raised)} raised
                          </span>
                        </div>
                        <div className="grid gap-0.5 text-xs text-muted-foreground sm:grid-cols-2">
                          <span>
                            Goal:{" "}
                            {campaign.goalAmount != null
                              ? formatDonationCurrency(campaign.goalAmount)
                              : "—"}
                          </span>
                          <span>
                            Outstanding pledges:{" "}
                            {formatDonationCurrency(campaign.outstandingPledgeBalance)}
                          </span>
                        </div>
                        <CampaignProgressBar progressPercent={campaign.progressPercent} />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="h-full">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Quick Actions</CardTitle>
            <CardDescription className="text-xs">
              Jump to common donation workflows
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <ul className="space-y-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon
                return (
                  <li key={action.href}>
                    <Link
                      href={action.href}
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {action.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

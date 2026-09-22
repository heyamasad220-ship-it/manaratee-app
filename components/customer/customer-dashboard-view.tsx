"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, DollarSign, Heart } from "lucide-react"

import {
  CustomerDashboardCampaigns,
  type CustomerDashboardCampaign,
} from "@/components/customer/customer-dashboard-campaigns"
import {
  CustomerDonationDialog,
  type CustomerDonationDialogPreset,
} from "@/components/customer/customer-donation-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type {
  CustomerDashboardActivityItem,
  CustomerDashboardAttentionItem,
  CustomerDashboardPageData,
  CustomerDashboardSummaryCard,
} from "@/lib/customer/customer-dashboard-types"

const SUMMARY_ACCENT = {
  emerald: {
    border: "border-l-4 border-l-emerald-500",
    value: "text-emerald-600",
    iconWrap: "bg-emerald-100",
    icon: "text-emerald-600",
    Icon: CheckCircle2,
  },
  primary: {
    border: "border-l-4 border-l-primary",
    value: "text-foreground",
    iconWrap: "bg-primary/10",
    icon: "text-primary",
    Icon: Heart,
  },
  amber: {
    border: "border-l-4 border-l-amber-500",
    value: "text-amber-600",
    iconWrap: "bg-amber-100",
    icon: "text-amber-600",
    Icon: DollarSign,
  },
} as const

function DashboardSummaryCards({ cards }: { cards: CustomerDashboardSummaryCard[] }) {
  if (cards.length === 0) return null

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const theme = SUMMARY_ACCENT[card.accent]
        const Icon = theme.Icon
        const content = (
          <Card className={`h-full border shadow-sm ${theme.border}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className={`mt-1 text-2xl font-bold ${theme.value}`}>{card.value}</p>
                </div>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${theme.iconWrap}`}
                >
                  <Icon className={`h-5 w-5 ${theme.icon}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        )

        if (!card.href) return <div key={card.key}>{content}</div>

        return (
          <Link key={card.key} href={card.href} className="block h-full">
            {content}
          </Link>
        )
      })}
    </section>
  )
}

function DashboardAttention({ items }: { items: CustomerDashboardAttentionItem[] }) {
  if (items.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Needs Your Attention</h2>
      <Card className="border shadow-sm">
        <CardContent className="divide-y p-0">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium leading-snug text-foreground">{item.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Button asChild size="sm" className="shrink-0 self-start sm:self-center">
                <Link href={item.href}>{item.actionLabel}</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}

function DashboardFeaturedCampaigns({
  campaigns,
  onDonate,
}: {
  campaigns: CustomerDashboardCampaign[]
  onDonate: (campaignId: string) => void
}) {
  if (campaigns.length === 0) return null

  return (
    <CustomerDashboardCampaigns
      campaigns={campaigns.map((campaign) => ({ ...campaign, allowsPledges: false }))}
      variant="preview"
      viewAllHref="/customer/donation"
      onOpenDonationDialog={(campaignId) => onDonate(campaignId)}
    />
  )
}

function DashboardRecentActivity({ items }: { items: CustomerDashboardActivityItem[] }) {
  if (items.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
        <Link
          href="/customer/donation?tab=payments"
          className="text-sm font-medium text-primary hover:underline"
        >
          View All →
        </Link>
      </div>
      <Card className="border shadow-sm">
        <CardContent className="divide-y p-0">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{item.dateLabel}</p>
                <p className="mt-0.5 font-medium leading-snug text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.subtitle}</p>
              </div>
              {item.amountLabel ? (
                <p className="shrink-0 text-sm font-semibold text-foreground">{item.amountLabel}</p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}

export function CustomerDashboardView({ data }: { data: CustomerDashboardPageData }) {
  const [donationDialogOpen, setDonationDialogOpen] = useState(false)
  const [donationDialogPreset, setDonationDialogPreset] = useState<
    CustomerDonationDialogPreset | undefined
  >(undefined)

  const openDonate = (campaignId: string) => {
    setDonationDialogPreset({ campaignId, frequency: "one-time" })
    setDonationDialogOpen(true)
  }

  const hasAnySection =
    data.summaryCards.length > 0 ||
    data.attentionItems.length > 0 ||
    data.featuredCampaigns.length > 0 ||
    data.recentActivity.length > 0

  if (!hasAnySection) {
    return <DashboardEmptyModuleNotice />
  }

  return (
    <div className="space-y-6">
      <DashboardSummaryCards cards={data.summaryCards} />
      <DashboardAttention items={data.attentionItems} />
      <DashboardFeaturedCampaigns
        campaigns={data.featuredCampaigns}
        onDonate={openDonate}
      />
      <DashboardRecentActivity items={data.recentActivity} />

      {data.donationsEnabled ? (
        <CustomerDonationDialog
          open={donationDialogOpen}
          onOpenChange={setDonationDialogOpen}
          preset={donationDialogPreset}
        />
      ) : null}
    </div>
  )
}

export function DashboardEmptyModuleNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card px-4 py-4 text-sm text-muted-foreground shadow-sm">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Your home page will show shortcuts and updates as modules are enabled for this organization.
      </p>
    </div>
  )
}

export type { CustomerDashboardPageData }

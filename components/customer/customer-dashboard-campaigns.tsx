"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Heart, HeartHandshake } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import type { DonationFrequency } from "@/components/customer/customer-donation-dialog"

export type CustomerDashboardCampaign = {
  id: string
  name: string
  description: string | null
  status?: string | null
  imageUrl?: string | null
  /** @deprecated Use imageUrl. Mapped from campaigns.flyer_url. */
  flyerUrl?: string | null
  goalAmount?: number | null
  raisedAmount?: number | null
  allowsPledges?: boolean
  detailsHref?: string | null
}

function campaignCoverUrl(campaign: CustomerDashboardCampaign) {
  return campaign.imageUrl?.trim() || campaign.flyerUrl?.trim() || null
}

function campaignStatusLabel(status?: string | null) {
  const value = String(status || "").trim()
  if (!value) return null
  return value.replace(/_/g, " ").toUpperCase()
}

export function CustomerDashboardCampaigns({
  campaigns,
  onOpenDonationDialog,
  onPledge,
  variant = "page",
  viewAllHref,
}: {
  campaigns: CustomerDashboardCampaign[]
  onOpenDonationDialog?: (campaignId: string, frequency: DonationFrequency) => void
  onPledge?: (campaignId: string) => void
  variant?: "page" | "preview"
  viewAllHref?: string
}) {
  const router = useRouter()
  const isPreview = variant === "preview"

  const goToPledge = (campaignId: string) => {
    if (onPledge) {
      onPledge(campaignId)
      return
    }
    router.push(`/customer/donation?campaign=${campaignId}&action=pledge`)
  }

  const openDonationDialog = (campaignId: string, frequency: DonationFrequency) => {
    if (onOpenDonationDialog) {
      onOpenDonationDialog(campaignId, frequency)
      return
    }
    router.push(`/customer/donation?campaign=${campaignId}&give=${frequency}`)
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Featured Campaigns</h2>
          <p className="text-sm text-muted-foreground">
            Support a current fundraising initiative.
          </p>
        </div>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="shrink-0 text-sm font-medium text-primary hover:underline"
          >
            <span className="sm:hidden">View All →</span>
            <span className="hidden sm:inline">View All Giving Opportunities →</span>
          </Link>
        ) : null}
      </div>

      {campaigns.length === 0 ? (
        isPreview ? null : (
          <Card className="border shadow-sm">
            <CardContent className="px-5 py-8 text-center text-sm text-muted-foreground">
              No featured campaigns are available right now.
            </CardContent>
          </Card>
        )
      ) : (
        <div
          className={
            campaigns.length === 1
              ? "max-w-2xl"
              : "grid items-start gap-4 md:grid-cols-2"
          }
        >
          {campaigns.map((campaign) => {
            const coverUrl = campaignCoverUrl(campaign)
            const statusLabel = campaignStatusLabel(campaign.status)
            const goalAmount =
              campaign.goalAmount != null && campaign.goalAmount > 0
                ? campaign.goalAmount
                : null
            const raisedAmount =
              campaign.raisedAmount == null ? null : Number(campaign.raisedAmount)
            const showProgress = goalAmount != null && raisedAmount != null
            const fundedPercent = showProgress
              ? Math.min((raisedAmount / goalAmount) * 100, 100)
              : null
            const showPledge = !isPreview && campaign.allowsPledges !== false

            return (
              <Card key={campaign.id} className="overflow-hidden border shadow-sm">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    {coverUrl ? (
                      <div
                        className={
                          isPreview
                            ? "h-20 w-full shrink-0 overflow-hidden rounded-md bg-muted sm:h-24 sm:w-28"
                            : "h-24 w-full shrink-0 overflow-hidden rounded-md bg-muted sm:h-28 sm:w-36"
                        }
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={coverUrl}
                          alt={`${campaign.name} campaign image`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}

                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold leading-snug text-foreground">
                          {campaign.name}
                        </h3>
                        {!isPreview && statusLabel ? (
                          <Badge className="shrink-0 bg-blue-100 text-blue-700 hover:bg-blue-100">
                            {statusLabel}
                          </Badge>
                        ) : null}
                      </div>

                      {campaign.description ? (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {campaign.description}
                        </p>
                      ) : null}

                      {showProgress ? (
                        <div className="space-y-1.5">
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="font-medium text-foreground">
                              {formatDonationCurrency(raisedAmount)} raised
                            </span>
                            <span className="text-muted-foreground">
                              {formatDonationCurrency(goalAmount)} goal
                            </span>
                          </div>
                          <Progress value={fundedPercent ?? 0} className="h-2" />
                          <p className="text-xs text-muted-foreground">
                            {Math.round(fundedPercent ?? 0)}% funded
                          </p>
                        </div>
                      ) : raisedAmount != null ? (
                        <p className="text-sm font-medium text-foreground">
                          {formatDonationCurrency(raisedAmount)} raised
                        </p>
                      ) : goalAmount != null ? (
                        <p className="text-sm text-muted-foreground">
                          {formatDonationCurrency(goalAmount)} goal
                        </p>
                      ) : null}

                      <div className="mt-auto flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          className="gap-2"
                          onClick={() => openDonationDialog(campaign.id, "one-time")}
                        >
                          <Heart className="h-4 w-4" />
                          Donate
                        </Button>
                        {showPledge ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => goToPledge(campaign.id)}
                          >
                            <HeartHandshake className="h-4 w-4" />
                            Make a Pledge
                          </Button>
                        ) : null}
                        {campaign.detailsHref ? (
                          <a
                            href={campaign.detailsHref}
                            className="ml-auto text-sm font-medium text-primary hover:underline"
                          >
                            View Campaign →
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}

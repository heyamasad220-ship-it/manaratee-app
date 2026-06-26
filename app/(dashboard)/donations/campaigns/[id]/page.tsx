"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, AlertCircle, DollarSign, Heart, Pencil, Target, TrendingUp, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CampaignEditDialog } from "@/components/donations/campaign-edit-dialog"
import { CampaignDonorsDialog } from "@/components/donations/campaign-donors-dialog"
import { CampaignProgressBar } from "@/components/donations/campaign-progress-bar"
import { CampaignProgressGauge } from "@/components/donations/campaign-progress-gauge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DonationMetricCard } from "@/components/donations/donation-metric-card"
import {
  formatDonationCurrency,
  type CampaignAnalyticsEntry,
  type CampaignDonorInsights,
  type CampaignRow,
} from "@/lib/donations/campaign-analytics"
import { getCampaignDetailAction } from "@/lib/donations/donation-reports-actions"
import { getDonorProfilePath } from "@/lib/donations/donor-profile-path"

export default function CampaignDetailPage() {
  const params = useParams()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<CampaignRow | null>(null)
  const [entry, setEntry] = useState<CampaignAnalyticsEntry | null>(null)
  const [insights, setInsights] = useState<CampaignDonorInsights | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDonorsDialog, setShowDonorsDialog] = useState(false)

  const loadCampaign = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)

    const result = await getCampaignDetailAction(campaignId)
    if (!result.success) {
      setErrorMessage(result.error)
      setCampaign(null)
      setEntry(null)
      setInsights(null)
      setLoading(false)
      return
    }

    setCampaign(result.campaign)
    setEntry(result.entry)
    setInsights(result.insights)
    setCanManage(result.canManage)
    setLoading(false)
  }, [campaignId])

  useEffect(() => {
    if (campaignId) loadCampaign()
  }, [campaignId, loadCampaign])

  const summaryCards = useMemo(() => {
    if (!entry) return []
    const { metrics } = entry
    return [
      { label: "Raised", value: formatDonationCurrency(metrics.raised), icon: DollarSign, accent: "emerald" as const },
      { label: "Pledged", value: formatDonationCurrency(metrics.pledged), icon: Heart, accent: "blue" as const },
      {
        label: "Outstanding",
        value: formatDonationCurrency(metrics.outstanding),
        icon: AlertCircle,
        accent: "amber" as const,
      },
      {
        label: "Total Committed",
        value: formatDonationCurrency(metrics.totalCommitted),
        icon: Target,
        accent: "purple" as const,
      },
    ]
  }, [entry])

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading campaign...</div>
  }

  if (!campaign || !entry || errorMessage) {
    return (
      <div className="p-6">
        <p className="text-red-600">{errorMessage || "Campaign not found."}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/donations/campaigns">Back to Campaigns</Link>
        </Button>
      </div>
    )
  }

  const { metrics } = entry
  const largestGift = insights?.largestGift
  const largestGiftHref =
    largestGift?.donorId != null
      ? getDonorProfilePath(largestGift.donorId, largestGift.donorType)
      : null

  return (
    <>
      <div className="p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/donations/campaigns">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Campaigns
              </Link>
            </Button>

            {canManage ? (
              <button
                type="button"
                onClick={() => setShowEditDialog(true)}
                className="group inline-flex items-center gap-2 text-2xl font-semibold text-foreground transition hover:text-primary"
              >
                {campaign.name}
                <Pencil className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
              </button>
            ) : (
              <h1 className="text-2xl font-semibold text-foreground">{campaign.name}</h1>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="mb-3 text-base font-semibold">Fundraising Summary</h3>
                <div className="grid grid-cols-1 gap-3">
                  {summaryCards.map((card) => (
                    <DonationMetricCard
                      key={card.label}
                      title={card.label}
                      value={card.value}
                      icon={card.icon}
                      accent={card.accent}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Collected against pledges:{" "}
                  {formatDonationCurrency(metrics.collectedAgainstPledges)}
                </p>
              </div>

              <div>
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
                  <Users className="h-4 w-4" />
                  Donor Metrics
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  <DonationMetricCard
                    title="Donors"
                    value={metrics.donorCount}
                    icon={Users}
                    accent="cyan"
                    onValueClick={() => setShowDonorsDialog(true)}
                  />
                  <DonationMetricCard
                    title="Largest Gift"
                    value={
                      largestGiftHref ? (
                        <Link href={largestGiftHref} className="text-inherit hover:underline">
                          {formatDonationCurrency(largestGift?.amount ?? metrics.largestGift)}
                        </Link>
                      ) : (
                        formatDonationCurrency(largestGift?.amount ?? metrics.largestGift)
                      )
                    }
                    icon={TrendingUp}
                    accent="rose"
                    description={
                      largestGift?.displayName && largestGift.amount > 0 ? (
                        largestGiftHref ? (
                          <Link href={largestGiftHref} className="hover:underline">
                            From {largestGift.displayName}
                          </Link>
                        ) : (
                          largestGift.displayName
                        )
                      ) : undefined
                    }
                  />
                </div>
              </div>
            </div>

            <Card className="flex w-full flex-col gap-2 py-4 lg:mt-9">
              <CardHeader className="px-4 py-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4" />
                  Goal Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-3 px-4 pb-2 pt-0">
                <CampaignProgressGauge
                  raised={metrics.raised}
                  goal={Number(campaign.goal_amount || 0) || null}
                  size="lg"
                  fluid
                  className="max-w-none"
                />
                {metrics.progressPercent != null ? (
                  <>
                    <CampaignProgressBar
                      progressPercent={metrics.progressPercent}
                      className="w-full"
                    />
                    <p className="text-center text-sm text-muted-foreground">
                      {formatDonationCurrency(metrics.raised)} raised of{" "}
                      {formatDonationCurrency(Number(campaign.goal_amount || 0))} goal (
                      {Math.round(metrics.progressPercent)}%)
                    </p>
                  </>
                ) : (
                  <p className="text-center text-sm text-muted-foreground">
                    Set a goal when editing this campaign to track progress on the gauge.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {canManage ? (
        <CampaignEditDialog
          campaign={campaign}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSaved={(updated) => {
            setCampaign(updated)
            void loadCampaign()
          }}
        />
      ) : null}

      <CampaignDonorsDialog
        campaignName={campaign.name}
        donors={insights?.donors || []}
        open={showDonorsDialog}
        onOpenChange={setShowDonorsDialog}
      />
    </>
  )
}

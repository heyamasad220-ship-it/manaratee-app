"use client"

import { AlertCircle, DollarSign, Gift, Heart, Target, Users } from "lucide-react"

import { CampaignDonorsDialog } from "@/components/donations/campaign-donors-dialog"
import { CampaignOutstandingPledgesTable } from "@/components/donations/campaign-outstanding-pledges-table"
import { CampaignOverviewInsightsPanel, CampaignOverviewGroupsCard } from "@/components/donations/campaign-overview-insights"
import { CampaignOverviewMetricsEditor } from "@/components/donations/campaign-overview-metrics-editor"
import { CampaignProgressBar } from "@/components/donations/campaign-progress-bar"
import { CampaignProgressGauge } from "@/components/donations/campaign-progress-gauge"
import { CampaignOverviewMetricsTable } from "@/components/donations/campaign-source-breakdown-cards"
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  formatDonationCurrency,
  type CampaignAnalyticsEntry,
  type CampaignDonorInsights,
  type CampaignOutstandingPledgeRow,
  type CampaignRow,
  type CampaignSourceBreakdown,
} from "@/lib/donations/campaign-analytics"
import type { CampaignOverviewMetricKey } from "@/lib/donations/campaign-overview-metrics"
import { donationPledgesHref } from "@/lib/donations/donation-pledge-paths"

type ContactProfileTarget = {
  contactId?: string | null
  donorId?: string | null
}

type CampaignOverviewTabProps = {
  campaign: CampaignRow
  entry: CampaignAnalyticsEntry
  insights: CampaignDonorInsights | null
  sourceBreakdown: CampaignSourceBreakdown
  outstandingPledges: CampaignOutstandingPledgeRow[]
  overviewMetricKeys: CampaignOverviewMetricKey[] | null
  canManage: boolean
  showMetricsEditor: boolean
  onShowMetricsEditorChange: (open: boolean) => void
  showDonorsDialog: boolean
  onShowDonorsDialogChange: (open: boolean) => void
  onOverviewMetricKeysSaved: (keys: CampaignOverviewMetricKey[] | null) => void
  onOpenContactProfile: (target: ContactProfileTarget) => void
  onReload: () => void
}

export function CampaignOverviewTab({
  campaign,
  entry,
  insights,
  sourceBreakdown,
  outstandingPledges,
  overviewMetricKeys,
  canManage,
  showMetricsEditor,
  onShowMetricsEditorChange,
  showDonorsDialog,
  onShowDonorsDialogChange,
  onOverviewMetricKeysSaved,
  onOpenContactProfile,
  onReload,
}: CampaignOverviewTabProps) {
  const { metrics } = entry
  const goalAmount = Number(campaign.goal_amount || 0) || null
  const committed = metrics.pledged
  const collected = metrics.raised
  const outstanding = metrics.outstanding
  const committedProgressPercent =
    goalAmount != null && goalAmount > 0
      ? Math.min((committed / goalAmount) * 100, 100)
      : null

  return (
    <>
      <div className="flex flex-col gap-6">
        <Card className="border border-border shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" />
              Campaign Goal
            </CardTitle>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {goalAmount != null ? formatDonationCurrency(goalAmount) : "No goal set"}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <DonationMetricCardGrid colorful columns={5}>
              <DonationMetricCard
                title="Total Committed"
                value={formatDonationCurrency(committed)}
                icon={Heart}
                accent="blue"
                description="Valid pledge commitments"
              />
              <DonationMetricCard
                title="Total Collected"
                value={formatDonationCurrency(collected)}
                icon={DollarSign}
                accent="emerald"
                description="Payments received"
              />
              <DonationMetricCard
                title="Outstanding"
                value={formatDonationCurrency(outstanding)}
                icon={AlertCircle}
                accent="amber"
                description="Committed, not yet collected"
              />
              <DonationMetricCard
                title="Donors"
                value={String(metrics.donorCount)}
                icon={Users}
                accent="purple"
                onValueClick={() => onShowDonorsDialogChange(true)}
              />
              <DonationMetricCard
                title="Largest Gift"
                value={formatDonationCurrency(metrics.largestGift)}
                icon={Gift}
                accent="rose"
                onValueClick={
                  insights?.largestGift?.contactId || insights?.largestGift?.donorId
                    ? () =>
                        onOpenContactProfile({
                          contactId: insights?.largestGift?.contactId,
                          donorId: insights?.largestGift?.donorId,
                        })
                    : undefined
                }
              />
            </DonationMetricCardGrid>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)] xl:items-start">
          <CampaignOverviewMetricsTable
            breakdown={sourceBreakdown}
            metrics={metrics}
            insights={insights}
            visibleMetricKeys={overviewMetricKeys}
            canCustomize={canManage}
            onCustomizeClick={() => onShowMetricsEditorChange(true)}
            onDonorsClick={() => onShowDonorsDialogChange(true)}
            onLargestGiftClick={
              insights?.largestGift?.contactId || insights?.largestGift?.donorId
                ? () =>
                    onOpenContactProfile({
                      contactId: insights?.largestGift?.contactId,
                      donorId: insights?.largestGift?.donorId,
                    })
                : undefined
            }
          />

          <Card className="flex w-full flex-col gap-2 py-4">
            <CardHeader className="px-4 py-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4" />
                Goal Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3 px-4 pb-2 pt-0">
              <CampaignProgressGauge
                raised={committed}
                goal={goalAmount}
                size="lg"
                fluid
                className="max-w-none"
              />
              {committedProgressPercent != null ? (
                <>
                  <CampaignProgressBar
                    progressPercent={committedProgressPercent}
                    className="w-full"
                  />
                  <p className="text-center text-sm text-muted-foreground">
                    {formatDonationCurrency(committed)} committed of{" "}
                    {formatDonationCurrency(goalAmount ?? 0)} goal (
                    {Math.round(committedProgressPercent)}%)
                  </p>
                  <p className="text-center text-xs text-muted-foreground">
                    {formatDonationCurrency(collected)} collected ·{" "}
                    {formatDonationCurrency(outstanding)} outstanding
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

        <CampaignOverviewInsightsPanel campaignId={campaign.id} />

        <CampaignOutstandingPledgesTable
          pledges={outstandingPledges}
          pledgesPageHref={donationPledgesHref({ campaignId: campaign.id })}
          onDonorClick={(pledge) =>
            onOpenContactProfile({
              contactId: pledge.contactId,
              donorId: pledge.donorId,
            })
          }
        />

        <CampaignOverviewGroupsCard campaignId={campaign.id} />
      </div>

      {canManage ? (
        <CampaignOverviewMetricsEditor
          campaignId={campaign.id}
          savedKeys={overviewMetricKeys}
          open={showMetricsEditor}
          onOpenChange={onShowMetricsEditorChange}
          onSaved={(keys) => {
            onOverviewMetricKeysSaved(keys)
            onReload()
          }}
        />
      ) : null}

      <CampaignDonorsDialog
        campaignName={campaign.name}
        donors={insights?.donors || []}
        open={showDonorsDialog}
        onOpenChange={onShowDonorsDialogChange}
        onDonorClick={(donor) =>
          onOpenContactProfile({
            contactId: donor.contactId,
            donorId: donor.donorId,
          })
        }
      />
    </>
  )
}

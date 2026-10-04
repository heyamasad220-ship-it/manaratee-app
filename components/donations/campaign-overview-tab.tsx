"use client"

import { useMemo, useState } from "react"

import { CampaignDonorsDialog } from "@/components/donations/campaign-donors-dialog"
import { CampaignOverviewInsightsPanel } from "@/components/donations/campaign-overview-insights"
import { CampaignOverviewMetricDialog } from "@/components/donations/campaign-overview-metric-dialog"
import { CampaignOverviewMetricsEditor } from "@/components/donations/campaign-overview-metrics-editor"
import { CampaignProgressBar } from "@/components/donations/campaign-progress-bar"
import { CampaignProgressGauge } from "@/components/donations/campaign-progress-gauge"
import { CampaignOverviewMetricsTable } from "@/components/donations/campaign-source-breakdown-cards"
import { Card, CardContent } from "@/components/ui/card"
import {
  campaignCommitmentRaised,
  formatDonationCurrency,
  type CampaignAnalyticsEntry,
  type CampaignDonorInsights,
  type CampaignOutstandingPledgeRow,
  type CampaignPaymentRow,
  type CampaignRow,
  type CampaignSourceBreakdown,
} from "@/lib/donations/campaign-analytics"
import { buildCampaignOverviewMetricDetail } from "@/lib/donations/campaign-overview-metric-details"
import type { CampaignOverviewMetricKey } from "@/lib/donations/campaign-overview-metrics"

type ContactProfileTarget = {
  contactId?: string | null
  donorId?: string | null
}

type CampaignOverviewTabProps = {
  campaign: CampaignRow
  entry: CampaignAnalyticsEntry
  insights: CampaignDonorInsights | null
  sourceBreakdown: CampaignSourceBreakdown
  payments: CampaignPaymentRow[]
  pledges: CampaignOutstandingPledgeRow[]
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
  payments,
  pledges,
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
  const totalRaised = campaignCommitmentRaised(metrics)
  const raisedProgressPercent =
    goalAmount != null && goalAmount > 0 ? Math.min((totalRaised / goalAmount) * 100, 100) : null
  const [detailKey, setDetailKey] = useState<string | null>(null)
  const detail = useMemo(
    () =>
      detailKey
        ? buildCampaignOverviewMetricDetail({
            key: detailKey,
            metrics,
            payments,
            pledges,
          })
        : null,
    [detailKey, metrics, payments, pledges]
  )

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)] xl:items-stretch">
          <CampaignOverviewMetricsTable
            breakdown={sourceBreakdown}
            metrics={metrics}
            goalAmount={goalAmount}
            visibleMetricKeys={overviewMetricKeys}
            canCustomize={canManage}
            onCustomizeClick={() => onShowMetricsEditorChange(true)}
            onMetricClick={(key) => {
              if (key === "donors") {
                onShowDonorsDialogChange(true)
                return
              }
              setDetailKey(key)
            }}
          />

          <Card className="flex h-full w-full flex-col pt-4 pb-6" aria-label="Goal progress">
            <CardContent className="flex flex-1 flex-col items-center justify-start gap-3 px-4 pb-2 pt-0">
              <CampaignProgressGauge raised={totalRaised} goal={goalAmount} size="lg" fluid className="max-w-none" />
              {raisedProgressPercent != null ? (
                <>
                  <CampaignProgressBar progressPercent={raisedProgressPercent} className="w-full" />
                  <p className="text-center text-sm text-muted-foreground">
                    {formatDonationCurrency(totalRaised)} raised of {formatDonationCurrency(goalAmount ?? 0)} goal (
                    {Math.round(raisedProgressPercent)}%)
                  </p>
                  <p className="text-center text-xs text-muted-foreground">
                    {formatDonationCurrency(metrics.raised)} collected · {formatDonationCurrency(metrics.outstanding)}{" "}
                    outstanding pledges
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
      <CampaignOverviewMetricDialog
        detail={detail}
        open={detailKey != null}
        onOpenChange={(open) => {
          if (!open) setDetailKey(null)
        }}
        onLineClick={(line) =>
          onOpenContactProfile({
            contactId: line.contactId,
            donorId: line.donorId,
          })
        }
      />
    </>
  )
}

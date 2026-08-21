"use client"

import { Target } from "lucide-react"

import { CampaignDonorsDialog } from "@/components/donations/campaign-donors-dialog"
import { CampaignOutstandingPledgesTable } from "@/components/donations/campaign-outstanding-pledges-table"
import { CampaignOverviewInsightsPanel } from "@/components/donations/campaign-overview-insights"
import { CampaignOverviewMetricsEditor } from "@/components/donations/campaign-overview-metrics-editor"
import { CampaignProgressBar } from "@/components/donations/campaign-progress-bar"
import { CampaignProgressGauge } from "@/components/donations/campaign-progress-gauge"
import { CampaignOverviewMetricsTable } from "@/components/donations/campaign-source-breakdown-cards"
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
import type { CampaignPhaseMetrics } from "@/lib/donations/campaign-phase-types"
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
  phaseMetrics: CampaignPhaseMetrics[]
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

function MetricStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function CampaignOverviewTab({
  campaign,
  entry,
  insights,
  sourceBreakdown,
  outstandingPledges,
  phaseMetrics,
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
  const remainingToGoal =
    goalAmount != null && goalAmount > 0 ? Math.max(goalAmount - committed, 0) : null
  const committedProgressPercent =
    goalAmount != null && goalAmount > 0
      ? Math.min((committed / goalAmount) * 100, 100)
      : null

  return (
    <>
      <div className="flex flex-col gap-6">
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" />
              Campaign Goal
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-3xl font-semibold tabular-nums text-foreground">
              {goalAmount != null ? formatDonationCurrency(goalAmount) : "No goal set"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricStat
                label="Total Committed"
                value={formatDonationCurrency(committed)}
                hint="Valid pledge commitments"
              />
              <MetricStat
                label="Total Collected"
                value={formatDonationCurrency(collected)}
                hint="Payments received"
              />
              <MetricStat
                label="Outstanding"
                value={formatDonationCurrency(outstanding)}
                hint="Committed, not yet collected"
              />
              <MetricStat
                label="Donors"
                value={String(metrics.donorCount)}
              />
              <MetricStat
                label="Largest Gift"
                value={formatDonationCurrency(metrics.largestGift)}
              />
            </div>
            {remainingToGoal != null ? (
              <p className="text-sm text-muted-foreground">
                Remaining to goal (by committed): {formatDonationCurrency(remainingToGoal)}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <CampaignOverviewInsightsPanel campaignId={campaign.id} />

        {phaseMetrics.length > 0 ? (
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-semibold text-foreground">Goal Breakdown</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {phaseMetrics.map((phase) => {
                const phaseProgress =
                  phase.goalAmount != null && phase.goalAmount > 0
                    ? Math.min((phase.committed / phase.goalAmount) * 100, 100)
                    : null
                return (
                  <Card key={phase.phaseId} className="border border-border shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{phase.name}</CardTitle>
                      {phase.deadline ? (
                        <p className="text-xs text-muted-foreground">
                          Deadline: {formatShortDate(phase.deadline)}
                        </p>
                      ) : null}
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <MetricStat
                          label="Goal"
                          value={
                            phase.goalAmount != null
                              ? formatDonationCurrency(phase.goalAmount)
                              : "—"
                          }
                        />
                        <MetricStat
                          label="Committed"
                          value={formatDonationCurrency(phase.committed)}
                        />
                        <MetricStat
                          label="Collected"
                          value={formatDonationCurrency(phase.collected)}
                        />
                        <MetricStat
                          label="Remaining to Goal"
                          value={
                            phase.remainingToGoal != null
                              ? formatDonationCurrency(phase.remainingToGoal)
                              : "—"
                          }
                        />
                      </div>
                      {phaseProgress != null ? (
                        <CampaignProgressBar progressPercent={phaseProgress} />
                      ) : null}
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Overall Campaign</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <MetricStat
                  label="Goal"
                  value={goalAmount != null ? formatDonationCurrency(goalAmount) : "—"}
                />
                <MetricStat label="Total Committed" value={formatDonationCurrency(committed)} />
                <MetricStat label="Total Collected" value={formatDonationCurrency(collected)} />
                <MetricStat
                  label="Remaining"
                  value={
                    remainingToGoal != null ? formatDonationCurrency(remainingToGoal) : "—"
                  }
                />
              </CardContent>
            </Card>
          </div>
        ) : null}

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

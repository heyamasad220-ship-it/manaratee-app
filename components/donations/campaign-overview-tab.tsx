"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { CampaignOverviewInsightsPanel } from "@/components/donations/campaign-overview-insights"
import { CampaignOverviewMetricDialog } from "@/components/donations/campaign-overview-metric-dialog"
import { CampaignProgressBar } from "@/components/donations/campaign-progress-bar"
import { CampaignProgressGauge } from "@/components/donations/campaign-progress-gauge"
import { CampaignOverviewMetricsTable } from "@/components/donations/campaign-source-breakdown-cards"
import { Card, CardContent } from "@/components/ui/card"
import {
  campaignCommitmentRaised,
  formatDonationCurrency,
  type CampaignAnalyticsEntry,
  type CampaignOutstandingPledgeRow,
  type CampaignPaymentRow,
  type CampaignRow,
  type CampaignSourceBreakdown,
} from "@/lib/donations/campaign-analytics"
import { loadCampaignReportContactsAction } from "@/lib/donations/campaign-report-contacts"
import { downloadCampaignReportExcel } from "@/lib/donations/campaign-report-excel"
import { downloadCampaignReportPdf } from "@/lib/donations/campaign-report-pdf"
import { buildCampaignOverviewMetricDetail } from "@/lib/donations/campaign-overview-metric-details"
import { DONATION_REPORTS_DONORS_PATH } from "@/lib/donations/donation-payment-paths"

type ContactProfileTarget = {
  contactId?: string | null
  donorId?: string | null
}

type CampaignOverviewTabProps = {
  campaign: CampaignRow
  entry: CampaignAnalyticsEntry
  sourceBreakdown: CampaignSourceBreakdown
  payments: CampaignPaymentRow[]
  pledges: CampaignOutstandingPledgeRow[]
  onOpenContactProfile: (target: ContactProfileTarget) => void
}

export function CampaignOverviewTab({
  campaign,
  entry,
  sourceBreakdown,
  payments,
  pledges,
  onOpenContactProfile,
}: CampaignOverviewTabProps) {
  const router = useRouter()
  const { metrics } = entry
  const goalAmount = Number(campaign.goal_amount || 0) || null
  const totalRaised = campaignCommitmentRaised(metrics)
  const raisedProgressPercent =
    goalAmount != null && goalAmount > 0 ? Math.min((totalRaised / goalAmount) * 100, 100) : null
  const [detailKey, setDetailKey] = useState<string | null>(null)
  const [reportBusy, setReportBusy] = useState(false)

  async function downloadReport(format: "pdf" | "excel") {
    setReportBusy(true)
    try {
      const contactResult = await loadCampaignReportContactsAction(
        pledges.map((pledge) => ({
          id: pledge.id,
          donorId: pledge.donorId,
          contactId: pledge.contactId,
        }))
      )
      if (!contactResult.success) {
        alert(contactResult.error)
        return
      }
      const reportPledges = pledges.map((pledge) => ({
        ...pledge,
        email: contactResult.contacts[pledge.id]?.email ?? null,
        phone: contactResult.contacts[pledge.id]?.phone ?? null,
      }))
      const report = {
        campaignName: campaign.name,
        generatedAt: new Date(),
        goalAmount,
        metrics,
        breakdown: sourceBreakdown,
        pledges: reportPledges,
      }
      if (format === "excel") await downloadCampaignReportExcel(report)
      else await downloadCampaignReportPdf(report)
    } finally {
      setReportBusy(false)
    }
  }
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
            reportBusy={reportBusy}
            onCampaignReport={() => void downloadReport("pdf")}
            onCampaignReportExcel={() => void downloadReport("excel")}
            onMetricClick={(key) => {
              if (key === "donors") {
                router.push(`${DONATION_REPORTS_DONORS_PATH}?campaignId=${campaign.id}`)
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

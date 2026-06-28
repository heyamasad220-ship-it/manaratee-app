"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Pencil, Target } from "lucide-react"

import { ContactProfileDialog } from "@/components/contacts/contact-profile-dialog"
import { Button } from "@/components/ui/button"
import { CampaignEditDialog } from "@/components/donations/campaign-edit-dialog"
import { CampaignDonorsDialog } from "@/components/donations/campaign-donors-dialog"
import { CampaignOverviewMetricsEditor } from "@/components/donations/campaign-overview-metrics-editor"
import { CampaignOutstandingPledgesTable } from "@/components/donations/campaign-outstanding-pledges-table"
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
import { getCampaignDetailAction } from "@/lib/donations/donation-reports-actions"
import type { CampaignOverviewMetricKey } from "@/lib/donations/campaign-overview-metrics"
import { createClient } from "@/lib/supabase/client"

type ContactProfileTarget = {
  contactId?: string | null
  donorId?: string | null
}

export default function CampaignDetailPage() {
  const params = useParams()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<CampaignRow | null>(null)
  const [entry, setEntry] = useState<CampaignAnalyticsEntry | null>(null)
  const [insights, setInsights] = useState<CampaignDonorInsights | null>(null)
  const [sourceBreakdown, setSourceBreakdown] = useState<CampaignSourceBreakdown | null>(null)
  const [outstandingPledges, setOutstandingPledges] = useState<CampaignOutstandingPledgeRow[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showMetricsEditor, setShowMetricsEditor] = useState(false)
  const [overviewMetricKeys, setOverviewMetricKeys] = useState<CampaignOverviewMetricKey[] | null>(
    null
  )
  const [showDonorsDialog, setShowDonorsDialog] = useState(false)
  const [contactProfileId, setContactProfileId] = useState<string | null>(null)
  const [showContactProfile, setShowContactProfile] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  const openContactProfile = useCallback(
    async ({ contactId, donorId }: ContactProfileTarget) => {
      let resolvedContactId = contactId ?? null

      if (!resolvedContactId && donorId) {
        const { data: donorRow } = await supabase
          .from("donors")
          .select("contact_id")
          .eq("id", donorId)
          .maybeSingle()

        resolvedContactId = (donorRow?.contact_id as string | null) ?? null
      }

      if (!resolvedContactId) {
        alert("No contact profile is linked to this donor yet.")
        return
      }

      setContactProfileId(resolvedContactId)
      setShowContactProfile(true)
    },
    [supabase]
  )

  const loadCampaign = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)

    const result = await getCampaignDetailAction(campaignId)
    if (!result.success) {
      setErrorMessage(result.error)
      setCampaign(null)
      setEntry(null)
      setInsights(null)
      setSourceBreakdown(null)
      setOutstandingPledges([])
      setLoading(false)
      return
    }

    setCampaign(result.campaign)
    setEntry(result.entry)
    setInsights(result.insights)
    setSourceBreakdown(result.sourceBreakdown)
    setOutstandingPledges(result.outstandingPledges)
    setOverviewMetricKeys(result.overviewMetricKeys)
    setCanManage(result.canManage)
    setLoading(false)
  }, [campaignId])

  useEffect(() => {
    if (campaignId) loadCampaign()
  }, [campaignId, loadCampaign])

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading campaign...</div>
  }

  if (!campaign || !entry || !sourceBreakdown || errorMessage) {
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
  const goalAmount = Number(campaign.goal_amount || 0) || null
  const progressPercent =
    goalAmount && goalAmount > 0
      ? Math.min((sourceBreakdown.totalRaised / goalAmount) * 100, 100)
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

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)] xl:items-start">
            <CampaignOverviewMetricsTable
              breakdown={sourceBreakdown}
              metrics={metrics}
              insights={insights}
              visibleMetricKeys={overviewMetricKeys}
              canCustomize={canManage}
              onCustomizeClick={() => setShowMetricsEditor(true)}
              onDonorsClick={() => setShowDonorsDialog(true)}
              onLargestGiftClick={
                insights?.largestGift?.contactId || insights?.largestGift?.donorId
                  ? () =>
                      void openContactProfile({
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
                  raised={sourceBreakdown.totalRaised}
                  goal={goalAmount}
                  size="lg"
                  fluid
                  className="max-w-none"
                />
                {progressPercent != null ? (
                  <>
                    <CampaignProgressBar progressPercent={progressPercent} className="w-full" />
                    <p className="text-center text-sm text-muted-foreground">
                      {formatDonationCurrency(sourceBreakdown.totalRaised)} total raised of{" "}
                      {formatDonationCurrency(goalAmount ?? 0)} goal ({Math.round(progressPercent)}%)
                    </p>
                    <p className="text-center text-xs text-muted-foreground">
                      {formatDonationCurrency(sourceBreakdown.collected)} collected
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
            onDonorClick={(pledge) =>
              void openContactProfile({
                contactId: pledge.contactId,
                donorId: pledge.donorId,
              })
            }
          />
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

      {canManage ? (
        <CampaignOverviewMetricsEditor
          campaignId={campaign.id}
          savedKeys={overviewMetricKeys}
          open={showMetricsEditor}
          onOpenChange={setShowMetricsEditor}
          onSaved={(keys) => {
            setOverviewMetricKeys(keys)
            void loadCampaign()
          }}
        />
      ) : null}

      <CampaignDonorsDialog
        campaignName={campaign.name}
        donors={insights?.donors || []}
        open={showDonorsDialog}
        onOpenChange={setShowDonorsDialog}
        onDonorClick={(donor) =>
          void openContactProfile({
            contactId: donor.contactId,
            donorId: donor.donorId,
          })
        }
      />

      <ContactProfileDialog
        contactId={contactProfileId}
        open={showContactProfile}
        onOpenChange={setShowContactProfile}
        onContactUpdated={() => void loadCampaign()}
      />
    </>
  )
}

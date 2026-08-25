"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Plus } from "lucide-react"

import { ContactProfileDialog } from "@/components/contacts/contact-profile-dialog"
import { Button } from "@/components/ui/button"
import { CampaignEditDialog } from "@/components/donations/campaign-edit-dialog"
import { PledgeDetailsDialog } from "@/components/donations/pledge-details-dialog"
import { CampaignGroupsTab } from "@/components/donations/campaign-groups-tab"
import { CampaignOverviewTab } from "@/components/donations/campaign-overview-tab"
import { CampaignProspectsTab } from "@/components/donations/campaign-prospects-tab"
import { CampaignStrategyTab } from "@/components/donations/campaign-strategy-tab"
import { CampaignWorkspaceNav } from "@/components/donations/campaign-workspace-nav"
import { CampaignWishlistTab } from "@/components/donations/campaign-wishlist-tab"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatDonationCurrency,
  type CampaignAnalyticsEntry,
  type CampaignDonorInsights,
  type CampaignOutstandingPledgeRow,
  type CampaignPaymentRow,
  type CampaignRow,
  type CampaignSourceBreakdown,
} from "@/lib/donations/campaign-analytics"
import { getCampaignDetailAction } from "@/lib/donations/donation-reports-actions"
import type { CampaignOverviewMetricKey } from "@/lib/donations/campaign-overview-metrics"
import type {
  CampaignAskLevelMetrics,
  CampaignAskLevelRow,
} from "@/lib/donations/campaign-ask-level-types"
import {
  parseCampaignWorkspaceTab,
} from "@/lib/donations/campaign-workspace-paths"
import { donationPledgesHref } from "@/lib/donations/donation-pledge-paths"
import { formatPaymentAllocationStatus, isOpenAllocatablePledge } from "@/lib/donations/donation-status"
import { createClient } from "@/lib/supabase/client"

type ContactProfileTarget = {
  contactId?: string | null
  donorId?: string | null
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "—"
  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
  const date = dateOnly ? new Date(`${dateOnly}T00:00:00`) : new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function CampaignPledgesTab({
  campaignId,
  pledges,
  canManage,
  onDonorClick,
  onAddPledge,
  onPledgeClick,
}: {
  campaignId: string
  pledges: CampaignOutstandingPledgeRow[]
  canManage: boolean
  onDonorClick: (pledge: CampaignOutstandingPledgeRow) => void
  onAddPledge: () => void
  onPledgeClick: (pledgeId: string) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">Campaign Pledges</h2>
          <p className="text-sm text-muted-foreground">
            Same pledge records as the global Pledges page, filtered to this campaign.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={donationPledgesHref({ campaignId })}>Open full pledges view</Link>
          </Button>
          {canManage ? (
            <Button onClick={onAddPledge}>
              <Plus className="mr-2 h-4 w-4" />
              Add Pledge
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="border border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Donor</TableHead>
                <TableHead>Pledge Date</TableHead>
                <TableHead className="text-right">Amount Pledged</TableHead>
                <TableHead className="text-right">Amount Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pledges.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No pledges for this campaign yet.
                  </TableCell>
                </TableRow>
              ) : (
                pledges.map((pledge) => (
                  <TableRow
                    key={pledge.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => onPledgeClick(pledge.id)}
                  >
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={(event) => {
                          event.stopPropagation()
                          onDonorClick(pledge)
                        }}
                      >
                        {pledge.donorName}
                      </button>
                    </TableCell>
                    <TableCell>{formatShortDate(pledge.pledgeDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDonationCurrency(pledge.amountPledged)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDonationCurrency(pledge.amountPaid)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-red-600">
                      {formatDonationCurrency(pledge.balanceRemaining)}
                    </TableCell>
                    <TableCell className="capitalize">{pledge.status}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function CampaignDonationsTab({
  payments,
  openPledgeDonorIds,
  openPledgeContactIds,
  onDonorClick,
  onPledgeClick,
}: {
  payments: CampaignPaymentRow[]
  openPledgeDonorIds: Set<string>
  openPledgeContactIds: Set<string>
  onDonorClick: (payment: CampaignPaymentRow) => void
  onPledgeClick: (pledgeId: string) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Campaign Donations</h2>
        <p className="text-sm text-muted-foreground">
          Actual payments attributed to this campaign (one ledger — no duplicate records).
        </p>
      </div>

      <Card className="border border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Donor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Pledge Applied To</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No donations for this campaign yet.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatShortDate(payment.payment_date)}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={() => onDonorClick(payment)}
                      >
                        {payment.sender_name || "Donor"}
                      </button>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDonationCurrency(Number(payment.amount || 0))}
                    </TableCell>
                    <TableCell className="capitalize">
                      {payment.source || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {payment.pledge_id ? (
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          title="Open pledge"
                          onClick={() => onPledgeClick(payment.pledge_id!)}
                        >
                          {`${payment.pledge_id.slice(0, 8)}…`}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">
                      {formatPaymentAllocationStatus({
                        status: payment.status,
                        pledgeId: payment.pledge_id,
                        donorHasOpenPledge: Boolean(
                          (payment.donor_id && openPledgeDonorIds.has(payment.donor_id)) ||
                            (payment.contact_id && openPledgeContactIds.has(payment.contact_id))
                        ),
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default function CampaignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const campaignId = params.id as string
  const activeTab = parseCampaignWorkspaceTab(searchParams.get("tab"))
  const selectedGroupId = searchParams.get("group")
  const prospectFollowUp = searchParams.get("followUp")
  const prospectAssignee = searchParams.get("assignee")
  const prospectStage = searchParams.get("stage")
  const prospectPledged = searchParams.get("pledged")

  const [campaign, setCampaign] = useState<CampaignRow | null>(null)
  const [entry, setEntry] = useState<CampaignAnalyticsEntry | null>(null)
  const [insights, setInsights] = useState<CampaignDonorInsights | null>(null)
  const [sourceBreakdown, setSourceBreakdown] = useState<CampaignSourceBreakdown | null>(null)
  const [outstandingPledges, setOutstandingPledges] = useState<CampaignOutstandingPledgeRow[]>([])
  const [campaignPledges, setCampaignPledges] = useState<CampaignOutstandingPledgeRow[]>([])
  const [askLevels, setAskLevels] = useState<CampaignAskLevelRow[]>([])
  const [askLevelMetrics, setAskLevelMetrics] = useState<CampaignAskLevelMetrics[]>([])
  const [campaignPayments, setCampaignPayments] = useState<CampaignPaymentRow[]>([])
  const [canManage, setCanManage] = useState(false)
  const [canManageCampaigns, setCanManageCampaigns] = useState(false)
  const [canManageProspects, setCanManageProspects] = useState(false)
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
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsPledgeId, setDetailsPledgeId] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])

  const { openPledgeDonorIds, openPledgeContactIds } = useMemo(() => {
    const donorIds = new Set<string>()
    const contactIds = new Set<string>()
    for (const pledge of campaignPledges) {
      if (
        !isOpenAllocatablePledge({
          status: pledge.status,
          balanceRemaining: pledge.balanceRemaining,
        })
      ) {
        continue
      }
      if (pledge.donorId) donorIds.add(pledge.donorId)
      if (pledge.contactId) contactIds.add(pledge.contactId)
    }
    return { openPledgeDonorIds: donorIds, openPledgeContactIds: contactIds }
  }, [campaignPledges])

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
    setErrorMessage(null)

    const result = await getCampaignDetailAction(campaignId)
    if (!result.success) {
      setErrorMessage(result.error)
      setCampaign(null)
      setEntry(null)
      setInsights(null)
      setSourceBreakdown(null)
      setOutstandingPledges([])
      setCampaignPledges([])
      setAskLevels([])
      setAskLevelMetrics([])
      setCampaignPayments([])
      setLoading(false)
      return
    }

    setCampaign(result.campaign)
    setEntry(result.entry)
    setInsights(result.insights)
    setSourceBreakdown(result.sourceBreakdown)
    setOutstandingPledges(result.outstandingPledges)
    setCampaignPledges(result.outstandingPledges)
    setAskLevels(result.askLevels || [])
    setAskLevelMetrics(result.askLevelMetrics || [])
    setOverviewMetricKeys(result.overviewMetricKeys)
    setCanManage(result.canManage)
    setCanManageCampaigns(result.canManageCampaigns)
    setCanManageProspects(result.canManageProspects)

    // Prefer full campaign pledge list for the Pledges tab (not only outstanding).
    const pledgesQuery = await supabase
      .from("pledge_status_view")
      .select(
        "id, donor_id, donor_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date"
      )
      .eq("organization_id", result.campaign.organization_id)
      .eq("campaign_id", campaignId)
      .order("pledge_date", { ascending: false })

    if (!pledgesQuery.error && pledgesQuery.data) {
      const donorIds = pledgesQuery.data
        .map((row) => row.donor_id as string | null)
        .filter((id): id is string => Boolean(id))
      const contactByDonor = new Map<string, string | null>()
      if (donorIds.length > 0) {
        const { data: donors } = await supabase
          .from("donors")
          .select("id, contact_id")
          .eq("organization_id", result.campaign.organization_id)
          .in("id", donorIds)
        for (const donor of donors || []) {
          contactByDonor.set(donor.id as string, (donor.contact_id as string | null) ?? null)
        }
      }

      setCampaignPledges(
        pledgesQuery.data.map((row) => ({
          id: row.id as string,
          donorId: (row.donor_id as string | null) ?? null,
          contactId: row.donor_id
            ? contactByDonor.get(row.donor_id as string) ?? null
            : null,
          donorName: (row.donor_name as string) || "Donor",
          amountPledged: Number(row.amount_pledged || 0),
          amountPaid: Number(row.amount_paid || 0),
          balanceRemaining: Number(row.balance_remaining || 0),
          status: String(row.calculated_status || "open"),
          pledgeDate: (row.pledge_date as string | null) ?? null,
          contactType: null,
          primaryContactName: null,
          memberGroups: [],
        }))
      )
    }

    // Load recent campaign payments for Donations tab (reuse payments table).
    const { data: payments } = await supabase
      .from("payments")
      .select(
        "id, campaign_id, campaign_phase_id, pledge_id, donor_id, contact_id, sender_name, amount, refunded_amount, payment_date, source, status, memo, recurring_donation_plan_id"
      )
      .eq("organization_id", result.campaign.organization_id)
      .eq("campaign_id", campaignId)
      .order("payment_date", { ascending: false })
      .limit(100)

    if (payments) {
      setCampaignPayments(payments as CampaignPaymentRow[])
    } else {
      const legacy = await supabase
        .from("payments")
        .select(
          "id, campaign_id, pledge_id, donor_id, contact_id, sender_name, amount, refunded_amount, payment_date, source, status, memo, recurring_donation_plan_id"
        )
        .eq("organization_id", result.campaign.organization_id)
        .eq("campaign_id", campaignId)
        .order("payment_date", { ascending: false })
        .limit(100)
      setCampaignPayments((legacy.data || []) as CampaignPaymentRow[])
    }

    setLoading(false)
  }, [campaignId, supabase])

  useEffect(() => {
    if (!campaignId) return
    setLoading(true)
    void loadCampaign()
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

  const endLabel = campaign.end_date ? formatShortDate(campaign.end_date) : null

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

            <div className="min-w-0">
              {canManageCampaigns ? (
                <button
                  type="button"
                  onClick={() => setShowEditDialog(true)}
                  className="max-w-full truncate text-left text-2xl font-semibold text-primary hover:underline"
                >
                  {campaign.name}
                </button>
              ) : (
                <h1 className="text-2xl font-semibold text-primary">{campaign.name}</h1>
              )}
              {endLabel ? (
                <p className="text-sm text-muted-foreground">{endLabel}</p>
              ) : null}
            </div>
          </div>

          <CampaignWorkspaceNav campaignId={campaign.id} activeTab={activeTab} />

          {activeTab === "overview" ? (
            <CampaignOverviewTab
              campaign={campaign}
              entry={entry}
              insights={insights}
              sourceBreakdown={sourceBreakdown}
              outstandingPledges={outstandingPledges}
              overviewMetricKeys={overviewMetricKeys}
              canManage={canManageCampaigns}
              showMetricsEditor={showMetricsEditor}
              onShowMetricsEditorChange={setShowMetricsEditor}
              showDonorsDialog={showDonorsDialog}
              onShowDonorsDialogChange={setShowDonorsDialog}
              onOverviewMetricKeysSaved={setOverviewMetricKeys}
              onOpenContactProfile={(target) => void openContactProfile(target)}
              onPledgeClick={(pledgeId) => {
                setDetailsPledgeId(pledgeId)
                setDetailsOpen(true)
              }}
              onReload={() => void loadCampaign()}
            />
          ) : null}

          {activeTab === "strategy" ? (
            <CampaignStrategyTab
              campaignId={campaign.id}
              askLevels={askLevels}
              askLevelMetrics={askLevelMetrics}
              canManage={canManageCampaigns}
              onSaved={() => void loadCampaign()}
            />
          ) : null}

          {activeTab === "prospects" ? (
            <CampaignProspectsTab
              campaignId={campaign.id}
              organizationId={campaign.organization_id}
              askLevels={askLevels}
              canManage={canManageProspects}
              onChanged={() => void loadCampaign()}
              initialFollowUp={
                prospectFollowUp === "overdue" || prospectFollowUp === "upcoming"
                  ? prospectFollowUp
                  : null
              }
              initialAssignee={prospectAssignee}
              initialStage={prospectStage}
              initialPledged={
                prospectPledged === "pledged" || prospectPledged === "not_pledged"
                  ? prospectPledged
                  : null
              }
            />
          ) : null}

          {activeTab === "pledges" ? (
            <CampaignPledgesTab
              campaignId={campaign.id}
              pledges={campaignPledges}
              canManage={canManage}
              onDonorClick={(pledge) =>
                void openContactProfile({
                  contactId: pledge.contactId,
                  donorId: pledge.donorId,
                })
              }
              onAddPledge={() => {
                setDetailsPledgeId(null)
                setDetailsOpen(true)
              }}
              onPledgeClick={(pledgeId) => {
                setDetailsPledgeId(pledgeId)
                setDetailsOpen(true)
              }}
            />
          ) : null}

          {activeTab === "donations" ? (
            <CampaignDonationsTab
              payments={campaignPayments}
              openPledgeDonorIds={openPledgeDonorIds}
              openPledgeContactIds={openPledgeContactIds}
              onDonorClick={(payment) =>
                void openContactProfile({
                  contactId: payment.contact_id,
                  donorId: payment.donor_id,
                })
              }
              onPledgeClick={(pledgeId) => {
                setDetailsPledgeId(pledgeId)
                setDetailsOpen(true)
              }}
            />
          ) : null}

          {activeTab === "groups" ? (
            <CampaignGroupsTab
              campaignId={campaign.id}
              campaignName={campaign.name}
              organizationId={campaign.organization_id}
              canManage={canManageCampaigns}
              selectedGroupId={selectedGroupId}
              onChanged={() => void loadCampaign()}
            />
          ) : null}

          {activeTab === "wishlist" ? (
            <CampaignWishlistTab
              campaignId={campaign.id}
              organizationId={campaign.organization_id}
              canManage={canManageCampaigns}
            />
          ) : null}
        </div>
      </div>

      {canManageCampaigns ? (
        <CampaignEditDialog
          campaign={campaign}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSaved={() => {
            void loadCampaign()
          }}
          onDeleted={() => {
            router.push("/donations/campaigns")
          }}
        />
      ) : null}

      <PledgeDetailsDialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open)
          if (!open) setDetailsPledgeId(null)
        }}
        pledgeId={detailsPledgeId}
        organizationId={campaign.organization_id}
        defaultCampaignId={campaign.id}
        canManage={canManage}
        onSaved={() => {
          void loadCampaign()
        }}
        onDeleted={() => {
          setDetailsOpen(false)
          setDetailsPledgeId(null)
          void loadCampaign()
        }}
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

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Plus } from "lucide-react"
import dynamic from "next/dynamic"

import { ContactProfileDialog } from "@/components/contacts/contact-profile-dialog"
import { Button } from "@/components/ui/button"
import { CampaignEditDialog } from "@/components/donations/campaign-edit-dialog"
import { PledgeDetailsDialog } from "@/components/donations/pledge-details-dialog"
import { CampaignGroupsTab } from "@/components/donations/campaign-groups-tab"
import {
  CampaignFundraisingPlanHeader,
  CampaignFundraisingPlanTab,
} from "@/components/donations/campaign-fundraising-plan-tab"
import { CampaignDonationsKpis } from "@/components/donations/campaign-donations-kpis"
import { CampaignEventKpis } from "@/components/donations/campaign-event-kpis"
import { CampaignOverviewSummary, CampaignOverviewTab } from "@/components/donations/campaign-overview-tab"
import { CampaignSponsorsTab } from "@/components/donations/campaign-sponsors-tab"
import { CampaignWorkspaceNav } from "@/components/donations/campaign-workspace-nav"
import { CampaignWishlistTab } from "@/components/donations/campaign-wishlist-tab"

const CampaignEventsTab = dynamic(
  () =>
    import("@/components/donations/campaign-events-tab").then((mod) => ({
      default: mod.CampaignEventsTab,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="text-sm text-muted-foreground">Loading event...</div>
    ),
  }
)
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
  campaignPaymentTypeLabel,
  type CampaignAnalyticsEntry,
  type CampaignDonorInsights,
  type CampaignOutstandingPledgeRow,
  type CampaignPaymentRow,
  type CampaignRecurringPlanRow,
  type CampaignRow,
  type CampaignSourceBreakdown,
} from "@/lib/donations/campaign-analytics"
import { getCampaignDetailAction } from "@/lib/donations/donation-reports-actions"
import type { CampaignEventStats } from "@/lib/events/campaign-event-actions"
import type { CampaignOverviewMetricKey } from "@/lib/donations/campaign-overview-metrics"
import type { CampaignFundraisingPlanKpis } from "@/lib/donations/campaign-prospect-types"
import {
  canonicalizeCampaignWorkspaceHref,
  isFundraisingPlanTab,
  parseCampaignWorkspaceTab,
} from "@/lib/donations/campaign-workspace-paths"
import { donationPledgesHref } from "@/lib/donations/donation-pledge-paths"
import { DONATION_RECURRING_OPS_PATH } from "@/lib/donations/donation-payment-paths"
import {
  formatRecurringFrequencyLabel,
  formatRecurringStatusLabel,
} from "@/lib/donations/recurring-donation-types"
import { formatPaymentAllocationStatus, isOpenAllocatablePledge } from "@/lib/donations/donation-status"
import { createClient } from "@/lib/supabase/client"
import { STAFF_MAIN_CONTENT_STICKY_TOP_CLASS } from "@/lib/layout/staff-dashboard-chrome"
import { cn } from "@/lib/utils"

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
  recurringPlans,
  openPledgeDonorIds,
  openPledgeContactIds,
  onDonorClick,
  onPledgeClick,
  onRecurringDonorClick,
}: {
  payments: CampaignPaymentRow[]
  recurringPlans: CampaignRecurringPlanRow[]
  openPledgeDonorIds: Set<string>
  openPledgeContactIds: Set<string>
  onDonorClick: (payment: CampaignPaymentRow) => void
  onPledgeClick: (pledgeId: string) => void
  onRecurringDonorClick: (plan: CampaignRecurringPlanRow) => void
}) {
  return (
    <div className="flex flex-col gap-6">
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
                <TableHead>Type</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Pledge Applied To</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
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
                    <TableCell>{campaignPaymentTypeLabel(payment)}</TableCell>
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

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Recurring</h2>
          <p className="text-sm text-muted-foreground">
            Monthly and other recurring plans tied to this campaign. Collected installments still
            appear in the ledger above.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={DONATION_RECURRING_OPS_PATH}>All recurring plans</Link>
        </Button>
      </div>

      <Card className="border border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Donor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Next payment</TableHead>
                <TableHead>Payments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recurringPlans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No recurring plans on this campaign yet.
                  </TableCell>
                </TableRow>
              ) : (
                recurringPlans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={() => onRecurringDonorClick(plan)}
                      >
                        {plan.donor_name}
                      </button>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDonationCurrency(plan.amount)}
                    </TableCell>
                    <TableCell>{formatRecurringFrequencyLabel(plan.frequency)}</TableCell>
                    <TableCell>{formatRecurringStatusLabel(plan.status)}</TableCell>
                    <TableCell>{formatShortDate(plan.start_date)}</TableCell>
                    <TableCell>{formatShortDate(plan.next_payment_date)}</TableCell>
                    <TableCell>
                      {plan.payments_made != null
                        ? plan.total_payments != null
                          ? `${plan.payments_made} / ${plan.total_payments}`
                          : String(plan.payments_made)
                        : "—"}
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

  const [campaign, setCampaign] = useState<CampaignRow | null>(null)
  const [entry, setEntry] = useState<CampaignAnalyticsEntry | null>(null)
  const [insights, setInsights] = useState<CampaignDonorInsights | null>(null)
  const [sourceBreakdown, setSourceBreakdown] = useState<CampaignSourceBreakdown | null>(null)
  const [outstandingPledges, setOutstandingPledges] = useState<CampaignOutstandingPledgeRow[]>([])
  const [campaignPledges, setCampaignPledges] = useState<CampaignOutstandingPledgeRow[]>([])
  const [campaignPayments, setCampaignPayments] = useState<CampaignPaymentRow[]>([])
  const [campaignRecurringPlans, setCampaignRecurringPlans] = useState<CampaignRecurringPlanRow[]>(
    []
  )
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
  const [eventStats, setEventStats] = useState<CampaignEventStats | null>(null)
  const [planKpis, setPlanKpis] = useState<CampaignFundraisingPlanKpis | null>(null)

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
      setCampaignPayments([])
      setCampaignRecurringPlans([])
      setLoading(false)
      return
    }

    setCampaign(result.campaign)
    setEntry(result.entry)
    setInsights(result.insights)
    setSourceBreakdown(result.sourceBreakdown)
    setOutstandingPledges(result.outstandingPledges)
    setCampaignPledges(result.campaignPledges)
    setCampaignPayments(result.campaignPayments)
    setCampaignRecurringPlans(result.campaignRecurringPlans)
    setOverviewMetricKeys(result.overviewMetricKeys)
    setCanManage(result.canManage)
    setCanManageCampaigns(result.canManageCampaigns)
    setCanManageProspects(result.canManageProspects)
    setLoading(false)
  }, [campaignId])

  useEffect(() => {
    if (!campaignId) return
    setLoading(true)
    void loadCampaign()
  }, [campaignId, loadCampaign])

  useEffect(() => {
    if (!campaignId) return
    const canonical = canonicalizeCampaignWorkspaceHref(campaignId, searchParams)
    if (!canonical) return
    const current = `${window.location.pathname}${window.location.search}`
    if (canonical !== current) {
      router.replace(canonical)
    }
  }, [campaignId, router, searchParams])

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

          <div
            className={cn(
              "sticky z-40 -mx-6 min-w-0 space-y-4 border-b border-border bg-background px-6 pb-4 pt-1",
              STAFF_MAIN_CONTENT_STICKY_TOP_CLASS
            )}
          >
            <CampaignWorkspaceNav campaignId={campaign.id} activeTab={activeTab} />
            {activeTab === "overview" ? (
              <CampaignOverviewSummary
                campaign={campaign}
                entry={entry}
                insights={insights}
                onShowDonorsDialogChange={setShowDonorsDialog}
                onOpenContactProfile={(target) => void openContactProfile(target)}
              />
            ) : null}
            {isFundraisingPlanTab(activeTab) ? (
              <CampaignFundraisingPlanHeader kpis={planKpis} />
            ) : null}
            {activeTab === "events" && eventStats ? (
              <CampaignEventKpis stats={eventStats} />
            ) : null}
            {activeTab === "donations" ? (
              <CampaignDonationsKpis
                payments={campaignPayments}
                recurringPlans={campaignRecurringPlans}
              />
            ) : null}
          </div>

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
              showSummary={false}
            />
          ) : null}

          {activeTab === "events" ? (
            <CampaignEventsTab
              campaignId={campaign.id}
              onStatsChange={setEventStats}
            />
          ) : null}

          {isFundraisingPlanTab(activeTab) ? (
            <CampaignFundraisingPlanTab
              campaignId={campaign.id}
              organizationId={campaign.organization_id}
              canManageProspects={canManageProspects}
              onProspectsChanged={() => void loadCampaign()}
              onKpisChange={setPlanKpis}
              showHeader={false}
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
              recurringPlans={campaignRecurringPlans}
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
              onRecurringDonorClick={(plan) =>
                void openContactProfile({
                  contactId: plan.contact_id,
                  donorId: plan.donor_id,
                })
              }
            />
          ) : null}

          {activeTab === "sponsors" ? (
            <CampaignSponsorsTab
              campaignId={campaign.id}
              canManage={canManageProspects}
              onChanged={() => void loadCampaign()}
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

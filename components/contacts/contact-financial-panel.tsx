"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Calendar,
  DollarSign,
  Loader2,
  Scale,
  TrendingUp,
} from "lucide-react"

import { DonorRecurringPanel } from "@/components/donations/donor-recurring-panel"
import { GivingStatementActions } from "@/components/donations/giving-statement-actions"
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { ContactPaymentMethodsPanel } from "@/components/contacts/contact-payment-methods-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { loadContactFinancialSummaryAction } from "@/lib/contacts/contact-financial-actions"
import type {
  ContactFinancialFilter,
  ContactFinancialSummaryPayload,
  ContactFinancialTimelineEvent,
  ContactOpenBalanceRow,
} from "@/lib/contacts/contact-financial-types"
import { mapPaymentToDonationHistoryRow } from "@/lib/donations/payment-admin-capabilities"
import { getPaymentDetailPageDataAction } from "@/lib/donations/payment-admin-actions"
import type { DonationHistoryRow } from "@/components/donations/donor-donation-history-table"
import type { ContactProfileModuleFlags } from "@/lib/contacts/contact-profile-module-access"
import type { ContactPaymentMethodRow } from "@/lib/contacts/contact-payment-method-actions"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import {
  isSafeReturnToPath,
  readStoredReturnToPath,
  RETURN_TO_QUERY_PARAM,
} from "@/lib/navigation/return-to"

const ContactFinancialPaymentEditDialog = dynamic(
  () =>
    import("@/components/contacts/contact-financial-payment-edit-dialog").then(
      (module) => module.ContactFinancialPaymentEditDialog
    ),
  { ssr: false }
)

const ContactFinancialPledgeEditDialog = dynamic(
  () =>
    import("@/components/contacts/contact-financial-pledge-edit-dialog").then(
      (module) => module.ContactFinancialPledgeEditDialog
    ),
  { ssr: false }
)

const FILTER_LABELS: Record<ContactFinancialFilter, string> = {
  all: "All Activity",
  donations: "Donations",
  pledges: "Pledges",
  programs: "Programs",
  venue_rentals: "Venue Rentals",
  membership: "Membership",
  other: "Other",
}

type FinancialActivitySection = "activity" | "payment_methods" | "statements"

function buildFinancialActivityTabs(input: {
  availableFilters: ContactFinancialFilter[]
  showPaymentMethodsTab: boolean
  showStatementsTab: boolean
}) {
  const tabs: Array<
    | { kind: "filter"; value: ContactFinancialFilter; label: string }
    | { kind: "section"; value: Exclude<FinancialActivitySection, "activity">; label: string }
  > = []

  for (const option of input.availableFilters) {
    tabs.push({ kind: "filter", value: option, label: FILTER_LABELS[option] })
    if (option === "pledges") {
      if (input.showPaymentMethodsTab) {
        tabs.push({ kind: "section", value: "payment_methods", label: "Payment Methods" })
      }
      if (input.showStatementsTab) {
        tabs.push({ kind: "section", value: "statements", label: "Statements" })
      }
    }
  }

  if (!input.availableFilters.includes("pledges")) {
    if (input.showPaymentMethodsTab) {
      tabs.push({ kind: "section", value: "payment_methods", label: "Payment Methods" })
    }
    if (input.showStatementsTab) {
      tabs.push({ kind: "section", value: "statements", label: "Statements" })
    }
  }

  return tabs
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getTimelinePaymentId(event: ContactFinancialTimelineEvent) {
  if (!event.id.startsWith("payment-")) return null
  return event.id.slice("payment-".length)
}

function getTimelinePledgeId(event: ContactFinancialTimelineEvent) {
  if (!event.id.startsWith("pledge-")) return null
  return event.id.slice("pledge-".length)
}

function isTimelineEventEditable(event: ContactFinancialTimelineEvent) {
  return (
    Boolean(getTimelinePaymentId(event)) ||
    Boolean(getTimelinePledgeId(event)) ||
    Boolean(event.href && !event.id.startsWith("payment-") && !event.id.startsWith("pledge-"))
  )
}

function OpenBalancesTable({ rows }: { rows: ContactOpenBalanceRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No open balances found for this contact.</p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Original</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.sourceModule}-${row.id}`}>
              <TableCell>{row.type}</TableCell>
              <TableCell className="max-w-[220px] truncate">
                {row.href ? (
                  <Link href={row.href} className="text-primary hover:underline">
                    {row.description}
                  </Link>
                ) : (
                  row.description
                )}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {row.originalAmount != null ? formatCurrency(row.originalAmount) : "—"}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {row.paidAmount != null ? formatCurrency(row.paidAmount) : "—"}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(row.balanceRemaining)}
              </TableCell>
              <TableCell>
                {row.status ? <Badge variant="secondary">{row.status}</Badge> : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

type ContactFinancialPanelProps = {
  contactId: string
  contactName: string
  donorId?: string | null
  personId?: string | null
  isGroup?: boolean
  modules: ContactProfileModuleFlags
  paymentMethods?: ContactPaymentMethodRow[]
  paymentMethodsLoading?: boolean
  showPaymentMethods?: boolean
}

export function ContactFinancialPanel({
  contactId,
  contactName,
  donorId,
  personId,
  isGroup = false,
  modules,
  paymentMethods = [],
  paymentMethodsLoading = false,
  showPaymentMethods = false,
}: ContactFinancialPanelProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ContactFinancialSummaryPayload | null>(null)
  const [filter, setFilter] = useState<ContactFinancialFilter>("all")
  const [section, setSection] = useState<FinancialActivitySection>("activity")
  const [openBalancesOpen, setOpenBalancesOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const result = await loadContactFinancialSummaryAction({
      contactId,
      donorId,
      personId,
      modules,
      isGroup,
    })

    if (!result.success) {
      setError(result.error)
      setData(null)
    } else {
      setData(result.data)
    }

    setLoading(false)
  }, [contactId, donorId, isGroup, modules, personId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredTimeline = useMemo(() => {
    if (!data) return []
    if (filter === "all") return data.timeline
    return data.timeline.filter((event) => event.filterCategory === filter)
  }, [data, filter])

  const showDonationSidebar = Boolean(modules.donations && donorId)
  const showPaymentMethodsTab = showPaymentMethods
  const showStatementsTab = showDonationSidebar && Boolean(donorId) && !isGroup

  const showSidebar =
    (showDonationSidebar && !isGroup) || modules.membership
  const hasAnyModule =
    modules.donations || modules.bookings || modules.programs || modules.membership

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading financial summary...
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
      </Card>
    )
  }

  if (!data || !hasAnyModule) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No financial modules are enabled for this organization.
        </CardContent>
      </Card>
    )
  }

  const { metrics, openBalances, availableFilters } = data
  const hasActivity = data.timeline.length > 0 || openBalances.length > 0

  return (
    <div className="space-y-6">
      {!isGroup ? (
        <DonationMetricCardGrid columns={4} colorful>
          <DonationMetricCard
            title="Total Paid"
            value={formatCurrency(metrics.totalPaid)}
            description={
              metrics.donationsOnlyTotalPaid
                ? "Donations only — other modules will add here when available"
                : "Received across donations, programs, and rentals"
            }
            icon={DollarSign}
            accent="emerald"
          />
          <DonationMetricCard
            title="Lifetime Contributions"
            value={formatCurrency(metrics.lifetimeContributions)}
            description="Charitable giving and donations only"
            icon={TrendingUp}
            accent="rose"
          />
          <DonationMetricCard
            title="Outstanding Balance"
            value={formatCurrency(metrics.outstandingBalance)}
            description="Click to view open balances"
            icon={Scale}
            accent="amber"
            onClick={() => setOpenBalancesOpen(true)}
          />
          <DonationMetricCard
            title="Last Financial Activity"
            value={formatDate(metrics.lastActivityDate)}
            description="Most recent payment, pledge, or fee event"
            icon={Calendar}
            accent="blue"
          />
        </DonationMetricCardGrid>
      ) : null}

      {!isGroup ? (
        <Sheet open={openBalancesOpen} onOpenChange={setOpenBalancesOpen}>
          <SheetContent className="flex w-full flex-col sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>Open Balances</SheetTitle>
              <SheetDescription>
                Amounts {contactName} still owes or has committed but not fully paid.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
              <OpenBalancesTable rows={openBalances} />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      {showSidebar ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <FinancialActivityCard
            section={section}
            onSectionChange={setSection}
            filter={filter}
            onFilterChange={setFilter}
            availableFilters={availableFilters}
            filteredTimeline={filteredTimeline}
            hasActivity={hasActivity}
            contactId={contactId}
            contactName={contactName}
            donorId={donorId}
            onTimelineUpdated={() => void loadData()}
            paymentMethods={paymentMethods}
            paymentMethodsLoading={paymentMethodsLoading}
            showPaymentMethodsTab={showPaymentMethodsTab}
            showStatementsTab={showStatementsTab}
            showGroupColumn={!isGroup}
          />

          <div className="space-y-6">
            {showDonationSidebar && !isGroup ? (
              <DonorRecurringPanel donorId={donorId!} />
            ) : null}

            {modules.membership ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Membership</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Membership dues and billing history will appear here when membership financial
                  records are linked to contacts.
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      ) : (
        <FinancialActivityCard
          section={section}
          onSectionChange={setSection}
          filter={filter}
          onFilterChange={setFilter}
          availableFilters={availableFilters}
          filteredTimeline={filteredTimeline}
          hasActivity={hasActivity}
          contactId={contactId}
          contactName={contactName}
          donorId={donorId}
          onTimelineUpdated={() => void loadData()}
          paymentMethods={paymentMethods}
          paymentMethodsLoading={paymentMethodsLoading}
          showPaymentMethodsTab={showPaymentMethodsTab}
          showStatementsTab={showStatementsTab}
          showGroupColumn={!isGroup}
        />
      )}
    </div>
  )
}

type FinancialActivityCardProps = {
  section: FinancialActivitySection
  onSectionChange: (section: FinancialActivitySection) => void
  filter: ContactFinancialFilter
  onFilterChange: (filter: ContactFinancialFilter) => void
  availableFilters: ContactFinancialFilter[]
  filteredTimeline: ContactFinancialSummaryPayload["timeline"]
  hasActivity: boolean
  contactId: string
  contactName: string
  donorId?: string | null
  onTimelineUpdated?: () => void
  paymentMethods: ContactPaymentMethodRow[]
  paymentMethodsLoading: boolean
  showPaymentMethodsTab: boolean
  showStatementsTab: boolean
  showGroupColumn?: boolean
}

function FinancialActivityCard({
  section,
  onSectionChange,
  filter,
  onFilterChange,
  availableFilters,
  filteredTimeline,
  hasActivity,
  contactId,
  contactName,
  donorId,
  onTimelineUpdated,
  paymentMethods,
  paymentMethodsLoading,
  showPaymentMethodsTab,
  showStatementsTab,
  showGroupColumn = false,
}: FinancialActivityCardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const profileReturnTo = useMemo(() => {
    const fromQuery = searchParams.get(RETURN_TO_QUERY_PARAM)
    if (fromQuery && isSafeReturnToPath(fromQuery)) {
      return fromQuery
    }
    return readStoredReturnToPath()
  }, [searchParams])
  const [openingPaymentId, setOpeningPaymentId] = useState<string | null>(null)
  const [pledgeEditId, setPledgeEditId] = useState<string | null>(null)
  const [paymentEdit, setPaymentEdit] = useState<{
    donorId: string
    row: DonationHistoryRow
    initialDialog: "edit" | "allocate"
  } | null>(null)

  const openPaymentEditor = useCallback(
    async (paymentId: string, initialDialog: "edit" | "allocate" = "edit") => {
      setOpeningPaymentId(paymentId)
      try {
        const result = await getPaymentDetailPageDataAction(paymentId)
        if (!result.success) {
          alert(result.error)
          return
        }

        if (!result.donorId) {
          alert("Link this payment to a donor before editing.")
          return
        }

        setPaymentEdit({
          donorId: result.donorId,
          initialDialog,
          row: mapPaymentToDonationHistoryRow({
            id: result.payment.id,
            amount: result.payment.amount,
            refunded_amount: result.payment.refundedAmount,
            payment_date: result.payment.paymentDate,
            source: result.payment.source,
            source_type: result.payment.sourceType,
            status: result.payment.status,
            memo: result.payment.memo,
            pledge_id: result.payment.pledgeId,
            import_batch_id: result.payment.importBatchId,
            stripe_payment_intent_id: result.payment.stripePaymentIntentId,
            stripe_charge_id: result.payment.stripeChargeId,
            donation_categories: result.payment.categoryName
              ? { name: result.payment.categoryName }
              : null,
          }),
        })
      } finally {
        setOpeningPaymentId(null)
      }
    },
    []
  )

  const handleTimelineDateClick = useCallback(
    (event: ContactFinancialTimelineEvent) => {
      const paymentId = getTimelinePaymentId(event)
      if (paymentId) {
        void openPaymentEditor(paymentId)
        return
      }

      const pledgeId = getTimelinePledgeId(event)
      if (pledgeId) {
        setPledgeEditId(pledgeId)
        return
      }

      if (event.href) {
        router.push(event.href)
      }
    },
    [openPaymentEditor, router]
  )

  const activityTabs = useMemo(
    () =>
      buildFinancialActivityTabs({
        availableFilters,
        showPaymentMethodsTab,
        showStatementsTab,
      }),
    [availableFilters, showPaymentMethodsTab, showStatementsTab]
  )

  return (
    <Card>
      <CardHeader className="gap-3 space-y-0">
        <CardTitle>Financial Activity</CardTitle>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {activityTabs.map((tab) => {
            const isActive =
              tab.kind === "filter"
                ? section === "activity" && filter === tab.value
                : section === tab.value

            return (
              <Button
                key={tab.kind === "filter" ? tab.value : tab.value}
                type="button"
                size="sm"
                variant={isActive ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => {
                  if (tab.kind === "filter") {
                    onSectionChange("activity")
                    onFilterChange(tab.value)
                    return
                  }
                  onSectionChange(tab.value)
                }}
              >
                {tab.label}
              </Button>
            )
          })}
        </div>
      </CardHeader>
      <CardContent>
        {section === "activity" ? (
          filteredTimeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {filter === "pledges"
                ? "There are no pledges."
                : hasActivity
                  ? "No activity matches this filter."
                  : "No financial activity recorded for this contact yet."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    {showGroupColumn ? <TableHead>Group</TableHead> : null}
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTimeline.map((event) => {
                    const editable = isTimelineEventEditable(event)
                    const paymentId = getTimelinePaymentId(event)
                    const isOpening = paymentId != null && openingPaymentId === paymentId

                    return (
                    <TableRow key={event.id}>
                      <TableCell className="whitespace-nowrap">
                        {editable ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-50"
                            disabled={isOpening}
                            onClick={() => handleTimelineDateClick(event)}
                          >
                            {isOpening ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            {formatDate(event.date)}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">{formatDate(event.date)}</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{event.eventType}</TableCell>
                      <TableCell className="max-w-[240px] truncate font-medium">
                        {event.description}
                      </TableCell>
                      {showGroupColumn ? (
                        <TableCell className="max-w-[160px] truncate">
                          {event.attributedGroupContactId ? (
                            <Link
                              href={contactProfileHref(event.attributedGroupContactId, {
                                tab: "financial",
                                returnTo: profileReturnTo ?? undefined,
                              })}
                              className="text-primary hover:underline"
                            >
                              {event.attributedGroupName || "Unnamed group"}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      ) : null}
                      <TableCell className="text-right">
                        {event.amount != null ? formatCurrency(event.amount) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {event.method || "—"}
                      </TableCell>
                      <TableCell>
                        {event.statusAction === "link_to_pledge" && paymentId ? (
                          <button
                            type="button"
                            className="text-sm text-primary hover:underline disabled:opacity-50"
                            disabled={isOpening}
                            onClick={() => void openPaymentEditor(paymentId, "allocate")}
                          >
                            Link to Pledge
                          </button>
                        ) : event.status ? (
                          <Badge variant="outline">{event.status}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )
        ) : null}

        {paymentEdit ? (
          <ContactFinancialPaymentEditDialog
            donorId={paymentEdit.donorId}
            donation={paymentEdit.row}
            initialDialog={paymentEdit.initialDialog}
            onClosed={() => setPaymentEdit(null)}
            onUpdated={() => {
              setPaymentEdit(null)
              onTimelineUpdated?.()
            }}
          />
        ) : null}

        {pledgeEditId ? (
          <ContactFinancialPledgeEditDialog
            pledgeId={pledgeEditId}
            open
            onOpenChange={(open) => {
              if (!open) setPledgeEditId(null)
            }}
            onUpdated={() => {
              setPledgeEditId(null)
              onTimelineUpdated?.()
            }}
          />
        ) : null}

        {section === "payment_methods" && showPaymentMethodsTab ? (
          paymentMethodsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading payment methods...
            </div>
          ) : (
            <ContactPaymentMethodsPanel
              contactId={contactId}
              paymentMethods={paymentMethods}
              embedded
            />
          )
        ) : null}

        {section === "statements" && showStatementsTab && donorId ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Generate, preview, download, or email annual giving statements for {contactName}.
            </p>
            <GivingStatementActions donorId={donorId} donorName={contactName} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

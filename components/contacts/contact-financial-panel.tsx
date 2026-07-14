"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Calendar,
  DollarSign,
  Loader2,
  Mail,
  Phone,
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
import { ContactProfileCollapsibleSection } from "@/components/contacts/contact-profile-collapsible-section"
import { Badge } from "@/components/ui/badge"
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
import { financialActivityStatusBadgeClass } from "@/lib/donations/donation-status"
import type {
  ContactFinancialSummaryPayload,
  ContactFinancialTimelineEvent,
  ContactOpenBalanceRow,
} from "@/lib/contacts/contact-financial-types"
import { mapPaymentToDonationHistoryRow } from "@/lib/donations/payment-admin-capabilities"
import { getPaymentDetailPageDataAction } from "@/lib/donations/payment-admin-actions"
import type { DonationHistoryRow } from "@/components/donations/donor-donation-history-table"
import type { ContactProfileModuleFlags } from "@/lib/contacts/contact-profile-module-access"
import type { ContactPaymentMethodRow } from "@/lib/contacts/contact-payment-method-actions"
import { cn } from "@/lib/utils"

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
  contactEmail?: string | null
  contactPhone?: string | null
  donorId?: string | null
  personId?: string | null
  isGroup?: boolean
  modules: ContactProfileModuleFlags
  paymentMethods?: ContactPaymentMethodRow[]
  paymentMethodsLoading?: boolean
  showPaymentMethods?: boolean
  /** Parent owns sticky identity; only show KPI cards and activity. */
  hideIdentity?: boolean
  /** When set with hideIdentity, identity + KPI cards share one sticky header. */
  stickyHeader?: ReactNode
  /** Rendered directly under the sticky strip (e.g. Summary/Participation tabs). */
  belowSticky?: ReactNode
  /** Rendered above All Transactions (e.g. Overview). */
  leadingContent?: ReactNode
  /** Sticky offset class for page chrome (omit / top-0 in dialogs). */
  stickyTopClass?: string
  /** Increment to reload summary (e.g. after inline payment/pledge create). */
  refreshToken?: number
  /** Rendered after Statements (e.g. Notes & Activity). */
  trailingContent?: ReactNode
}

function ContactFinancialIdentity({
  name,
  email,
  phone,
}: {
  name: string
  email?: string | null
  phone?: string | null
}) {
  return (
    <div className="min-w-0 shrink-0 space-y-3 lg:w-[220px] xl:w-[260px]">
      <h2 className="text-lg font-semibold leading-tight text-foreground">{name}</h2>
      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2 text-muted-foreground">
          <Phone className="mt-0.5 h-4 w-4 shrink-0" />
          {phone ? (
            <a href={`tel:${phone}`} className="break-all text-foreground hover:underline">
              {phone}
            </a>
          ) : (
            <span>—</span>
          )}
        </div>
        <div className="flex items-start gap-2 text-muted-foreground">
          <Mail className="mt-0.5 h-4 w-4 shrink-0" />
          {email ? (
            <a href={`mailto:${email}`} className="break-all text-foreground hover:underline">
              {email}
            </a>
          ) : (
            <span>—</span>
          )}
        </div>
      </div>
    </div>
  )
}

function ContactFinancialMetricsGrid({
  metrics,
  onOpenBalances,
}: {
  metrics: ContactFinancialSummaryPayload["metrics"]
  onOpenBalances: () => void
}) {
  return (
    <DonationMetricCardGrid columns={4} colorful compact className="w-full min-w-0">
      <DonationMetricCard
        title="Total Paid"
        value={formatCurrency(metrics.totalPaid)}
        icon={DollarSign}
        accent="emerald"
        compact
      />
      <DonationMetricCard
        title="Lifetime Contributions"
        value={formatCurrency(metrics.lifetimeContributions)}
        icon={TrendingUp}
        accent="rose"
        compact
      />
      <DonationMetricCard
        title="Outstanding Balance"
        value={formatCurrency(metrics.outstandingBalance)}
        icon={Scale}
        accent="amber"
        compact
        onClick={onOpenBalances}
      />
      <DonationMetricCard
        title="Last Activity"
        value={formatDate(metrics.lastActivityDate)}
        icon={Calendar}
        accent="blue"
        compact
      />
    </DonationMetricCardGrid>
  )
}

function ContactFinancialSummaryStrip({
  contactName,
  contactEmail,
  contactPhone,
  metrics,
  onOpenBalances,
  hideIdentity = false,
  stickyTopClass = "top-0",
}: {
  contactName: string
  contactEmail?: string | null
  contactPhone?: string | null
  metrics: ContactFinancialSummaryPayload["metrics"]
  onOpenBalances: () => void
  hideIdentity?: boolean
  stickyTopClass?: string
}) {
  if (hideIdentity) {
    return <ContactFinancialMetricsGrid metrics={metrics} onOpenBalances={onOpenBalances} />
  }

  return (
    <div
      className={cn(
        "sticky z-40 -mx-6 border-b border-border bg-background px-6 pb-4 pt-1",
        stickyTopClass
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <ContactFinancialIdentity
          name={contactName}
          email={contactEmail}
          phone={contactPhone}
        />
        <div className="w-full min-w-0 lg:max-w-2xl lg:flex-1">
          <ContactFinancialMetricsGrid metrics={metrics} onOpenBalances={onOpenBalances} />
        </div>
      </div>
    </div>
  )
}

export function ContactFinancialPanel({
  contactId,
  contactName,
  contactEmail,
  contactPhone,
  donorId,
  personId,
  isGroup = false,
  modules,
  paymentMethods = [],
  paymentMethodsLoading = false,
  showPaymentMethods = false,
  hideIdentity = false,
  stickyHeader,
  belowSticky,
  leadingContent,
  trailingContent,
  refreshToken = 0,
  stickyTopClass = "top-0",
}: ContactFinancialPanelProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ContactFinancialSummaryPayload | null>(null)
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
  }, [loadData, refreshToken])

  const showDonationSidebar = Boolean(modules.donations && donorId)
  const showPaymentPlansTab = showDonationSidebar && !isGroup
  const showPaymentMethodsTab = showPaymentMethods
  const showStatementsTab = showDonationSidebar && Boolean(donorId) && !isGroup

  const showMembershipSidebar = modules.membership && !isGroup
  const hasAnyModule =
    modules.donations || modules.bookings || modules.programs || modules.membership

  const contactIdentity = hideIdentity ? null : (
    <ContactFinancialIdentity
      name={contactName}
      email={contactEmail}
      phone={contactPhone}
    />
  )

  function renderCombinedSticky(metricsContent: ReactNode) {
    if (!hideIdentity || !stickyHeader) return null
    return (
      <div
        className={cn(
          "sticky z-40 -mx-6 space-y-4 border-b border-border bg-background px-6 pb-4 pt-1",
          stickyTopClass
        )}
      >
        {stickyHeader}
        {metricsContent}
      </div>
    )
  }

  const stickyStripClassName = cn(
    "sticky z-40 -mx-6 border-b border-border bg-background px-6 pb-4 pt-1",
    stickyTopClass
  )

  if (loading) {
    return (
      <div className="space-y-6">
        {hideIdentity && stickyHeader ? (
          renderCombinedSticky(
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading financial summary...
            </div>
          )
        ) : hideIdentity ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading financial summary...
          </div>
        ) : (
          <div className={stickyStripClassName}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              {contactIdentity}
              <div className="flex flex-1 items-center gap-2 text-sm text-muted-foreground lg:justify-end">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading financial summary...
              </div>
            </div>
          </div>
        )}
        {belowSticky}
        <div className="space-y-3">
          {leadingContent}
          {trailingContent}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        {hideIdentity && stickyHeader
          ? renderCombinedSticky(null)
          : contactIdentity ? (
              <div className={stickyStripClassName}>
                {contactIdentity}
              </div>
            ) : null}
        {belowSticky}
        <div className="space-y-3">
          {leadingContent}
          <Card>
            <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
          </Card>
          {trailingContent}
        </div>
      </div>
    )
  }

  if (!data || !hasAnyModule) {
    return (
      <div className="space-y-6">
        {hideIdentity && stickyHeader
          ? renderCombinedSticky(null)
          : contactIdentity ? (
              <div className={stickyStripClassName}>
                {contactIdentity}
              </div>
            ) : null}
        {belowSticky}
        <div className="space-y-3">
          {leadingContent}
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No financial modules are enabled for this organization.
            </CardContent>
          </Card>
          {trailingContent}
        </div>
      </div>
    )
  }

  const { metrics, openBalances } = data
  const hasActivity = data.timeline.length > 0 || openBalances.length > 0

  const metricsBlock = !isGroup ? (
    <ContactFinancialSummaryStrip
      contactName={contactName}
      contactEmail={contactEmail}
      contactPhone={contactPhone}
      metrics={metrics}
      onOpenBalances={() => setOpenBalancesOpen(true)}
      hideIdentity={hideIdentity}
      stickyTopClass={stickyTopClass}
    />
  ) : contactIdentity ? (
    contactIdentity
  ) : null

  return (
    <div className="space-y-6">
      {hideIdentity && stickyHeader
        ? renderCombinedSticky(
            !isGroup ? (
              <ContactFinancialMetricsGrid
                metrics={metrics}
                onOpenBalances={() => setOpenBalancesOpen(true)}
              />
            ) : null
          )
        : metricsBlock}

      {belowSticky}

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

      {showMembershipSidebar ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <FinancialActivitySections
            timeline={data.timeline}
            hasActivity={hasActivity}
            contactId={contactId}
            contactName={contactName}
            donorId={donorId}
            onTimelineUpdated={() => void loadData()}
            paymentMethods={paymentMethods}
            paymentMethodsLoading={paymentMethodsLoading}
            showPaymentPlans={showPaymentPlansTab}
            showPaymentMethods={showPaymentMethodsTab}
            showStatements={showStatementsTab}
            leadingContent={leadingContent}
            trailingContent={trailingContent}
          />

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Membership</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Membership dues and billing history will appear here when membership financial
                records are linked to contacts.
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <FinancialActivitySections
          timeline={data.timeline}
          hasActivity={hasActivity}
          contactId={contactId}
          contactName={contactName}
          donorId={donorId}
          onTimelineUpdated={() => void loadData()}
          paymentMethods={paymentMethods}
          paymentMethodsLoading={paymentMethodsLoading}
          showPaymentPlans={showPaymentPlansTab}
          showPaymentMethods={showPaymentMethodsTab}
          showStatements={showStatementsTab}
          leadingContent={leadingContent}
          trailingContent={trailingContent}
        />
      )}
    </div>
  )
}

type FinancialActivitySectionsProps = {
  timeline: ContactFinancialSummaryPayload["timeline"]
  hasActivity: boolean
  contactId: string
  contactName: string
  donorId?: string | null
  onTimelineUpdated?: () => void
  paymentMethods: ContactPaymentMethodRow[]
  paymentMethodsLoading: boolean
  showPaymentPlans: boolean
  showPaymentMethods: boolean
  showStatements: boolean
  leadingContent?: ReactNode
  trailingContent?: ReactNode
}

function FinancialActivitySections({
  timeline,
  hasActivity,
  contactId,
  contactName,
  donorId,
  onTimelineUpdated,
  paymentMethods,
  paymentMethodsLoading,
  showPaymentPlans,
  showPaymentMethods,
  showStatements,
  leadingContent,
  trailingContent,
}: FinancialActivitySectionsProps) {
  const router = useRouter()
  const [openingPaymentId, setOpeningPaymentId] = useState<string | null>(null)
  const [pledgeEditId, setPledgeEditId] = useState<string | null>(null)
  const [paymentEdit, setPaymentEdit] = useState<{
    donorId: string
    row: DonationHistoryRow
    initialDialog: "edit" | "allocate"
  } | null>(null)

  const transactions = useMemo(
    () => timeline.filter((event) => event.filterCategory !== "pledges"),
    [timeline]
  )
  const pledges = useMemo(
    () => timeline.filter((event) => event.filterCategory === "pledges"),
    [timeline]
  )

  const [transactionsOpen, setTransactionsOpen] = useState(false)
  const [paymentPlansOpen, setPaymentPlansOpen] = useState(false)
  const [pledgesOpen, setPledgesOpen] = useState(false)
  const [paymentMethodsOpen, setPaymentMethodsOpen] = useState(false)
  const [statementsOpen, setStatementsOpen] = useState(false)
  const [paymentPlansCount, setPaymentPlansCount] = useState<number | null>(null)

  const handleHasPlansChange = useCallback((info: { hasPlans: boolean; count: number }) => {
    setPaymentPlansCount(info.count)
  }, [])

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

  function renderTimelineTable(
    rows: ContactFinancialTimelineEvent[],
    emptyMessage: string
  ) {
    if (rows.length === 0) {
      return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
    }

    return (
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((event) => {
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
                        {isOpening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
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
                  <TableCell className="text-right">
                    {event.amount != null ? formatCurrency(event.amount) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{event.method || "—"}</TableCell>
                  <TableCell>
                    {event.status ? (
                      <Badge
                        variant="outline"
                        className={cn(financialActivityStatusBadgeClass(event.status))}
                      >
                        {event.status}
                      </Badge>
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
  }

  return (
    <div className="space-y-3">
      {leadingContent}

      <ContactProfileCollapsibleSection
        title="All Transactions"
        count={transactions.length}
        open={transactionsOpen}
        onOpenChange={setTransactionsOpen}
      >
        {renderTimelineTable(
          transactions,
          hasActivity
            ? "No transactions recorded for this contact yet."
            : "No financial activity recorded for this contact yet."
        )}
      </ContactProfileCollapsibleSection>

      {showPaymentPlans && donorId ? (
        <ContactProfileCollapsibleSection
          title="Payment Plans"
          count={paymentPlansCount}
          open={paymentPlansOpen}
          onOpenChange={setPaymentPlansOpen}
        >
          <DonorRecurringPanel
            donorId={donorId}
            embedded
            onHasPlansChange={handleHasPlansChange}
          />
        </ContactProfileCollapsibleSection>
      ) : null}

      <ContactProfileCollapsibleSection
        title="Pledges"
        count={pledges.length}
        open={pledgesOpen}
        onOpenChange={setPledgesOpen}
      >
        {renderTimelineTable(pledges, "There are no pledges.")}
      </ContactProfileCollapsibleSection>

      {showPaymentMethods ? (
        <ContactProfileCollapsibleSection
          title="Payment Methods"
          count={paymentMethodsLoading ? null : paymentMethods.length}
          open={paymentMethodsOpen}
          onOpenChange={setPaymentMethodsOpen}
        >
          {paymentMethodsLoading ? (
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
          )}
        </ContactProfileCollapsibleSection>
      ) : null}

      {showStatements && donorId ? (
        <ContactProfileCollapsibleSection
          title="Statements"
          open={statementsOpen}
          onOpenChange={setStatementsOpen}
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Generate, preview, download, or email annual giving statements for {contactName}.
            </p>
            <GivingStatementActions donorId={donorId} donorName={contactName} />
          </div>
        </ContactProfileCollapsibleSection>
      ) : null}

      {trailingContent}

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
    </div>
  )
}

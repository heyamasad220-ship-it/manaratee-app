"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Calendar,
  CreditCard,
  DollarSign,
  FileText,
  Info,
  Loader2,
  Mail,
  Phone,
  Scale,
} from "lucide-react"
import { Cell, Pie, PieChart } from "recharts"

import { PledgeDetailsDialog } from "@/components/donations/pledge-details-dialog"
import { DonationRecurringPanel } from "@/components/donations/donation-recurring-panel"
import { DonorPledgesTab } from "@/components/donations/donor-pledges-tab"
import { GivingStatementActions } from "@/components/donations/giving-statement-actions"
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { ContactPaymentMethodsPanel } from "@/components/contacts/contact-payment-methods-panel"
import { ContactFundDevelopmentHistory } from "@/components/contacts/contact-fund-development-history"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { loadContactFinancialSummaryAction, loadCustomerMyTransactionsSummaryAction } from "@/lib/contacts/contact-financial-actions"
import { financialActivityStatusBadgeClass } from "@/lib/donations/donation-status"
import type {
  ContactFinancialSummaryPayload,
  ContactFinancialTimelineEvent,
  ContactOpenBalanceRow,
  ContactFinancialSourceModule,
} from "@/lib/contacts/contact-financial-types"
import { mapPaymentToDonationHistoryRow } from "@/lib/donations/payment-admin-capabilities"
import { getPaymentDetailPageDataAction } from "@/lib/donations/payment-admin-actions"
import type { DonationHistoryRow } from "@/components/donations/donor-donation-history-table"
import { ContactTransactionRowActions } from "@/components/contacts/contact-transaction-row-actions"
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

const RECENT_TRANSACTION_LIMIT = 5

const MODULE_CHART_COLORS: Record<ContactFinancialSourceModule, string> = {
  donations: "#10b981",
  programs: "#8b5cf6",
  venue_rentals: "#f59e0b",
  vendor_hub: "#ea580c",
  membership: "#06b6d4",
  other: "#94a3b8",
}

const MODULE_LABELS: Record<ContactFinancialSourceModule, string> = {
  donations: "Donations",
  programs: "Programs",
  venue_rentals: "Venue Rentals",
  vendor_hub: "Vendor Hub",
  membership: "Membership",
  other: "Other",
}

type FinancialDetailTab =
  | "payment-plans"
  | "pledges"
  | "invoices"
  | "refunds"
  | "payment-methods"

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

function isTimelineEventEditable(event: ContactFinancialTimelineEvent) {
  return (
    Boolean(getTimelinePaymentId(event)) ||
    Boolean(event.href && !event.id.startsWith("payment-") && !event.id.startsWith("pledge-"))
  )
}

function isRefundEvent(event: ContactFinancialTimelineEvent) {
  const status = (event.status || "").toLowerCase()
  const type = (event.eventType || "").toLowerCase()
  return status.includes("refund") || type.includes("refund")
}

function isPaidTransaction(event: ContactFinancialTimelineEvent) {
  const status = (event.status || "").toLowerCase()
  return (
    event.amount != null &&
    event.filterCategory !== "pledges" &&
    !isRefundEvent(event) &&
    status !== "voided" &&
    status !== "failed"
  )
}

function OpenBalancesTable({
  rows,
  onPledgeClick,
}: {
  rows: ContactOpenBalanceRow[]
  onPledgeClick?: (pledgeId: string) => void
}) {
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
                {row.type === "Pledge" && onPledgeClick ? (
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => onPledgeClick(row.id)}
                  >
                    {row.description}
                  </button>
                ) : row.href ? (
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
  /** Customer portal read-only mirror of the staff Financial tab. */
  variant?: "staff" | "customer"
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
  /**
   * staff-overview: KPI + by-module chart + recent transactions (Contact Overview).
   * staff-details: detail tabs + payment methods / statements (Financial tab).
   * full: customer / legacy complete layout.
   */
  surface?: "full" | "staff-overview" | "staff-details"
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

function buildModuleBreakdown(
  timeline: ContactFinancialTimelineEvent[],
  modules: ContactProfileModuleFlags
) {
  const totals: Partial<Record<ContactFinancialSourceModule, number>> = {}

  for (const event of timeline) {
    if (!isPaidTransaction(event) || event.amount == null || event.amount <= 0) continue
    totals[event.sourceModule] = (totals[event.sourceModule] ?? 0) + event.amount
  }

  const order: ContactFinancialSourceModule[] = []
  if (modules.donations) order.push("donations")
  if (modules.programs) order.push("programs")
  if (modules.bookings) order.push("venue_rentals")
  if (modules.vendorHub) order.push("vendor_hub")
  if (modules.membership) order.push("membership")
  if ((totals.other ?? 0) > 0) order.push("other")

  const slices = order
    .map((key) => ({
      key,
      name: MODULE_LABELS[key],
      value: totals[key] ?? 0,
      color: MODULE_CHART_COLORS[key],
    }))
    .filter((slice) => order.length <= 1 || slice.value > 0 || modules.donations || modules.programs)

  // Keep zero slices for enabled modules so legend matches mockup (Donations / Programs)
  const enabledSlices = order.map((key) => ({
    key,
    name: MODULE_LABELS[key],
    value: totals[key] ?? 0,
    color: MODULE_CHART_COLORS[key],
  }))

  const totalPaid = enabledSlices.reduce((sum, slice) => sum + slice.value, 0)
  return { slices: enabledSlices.length > 0 ? enabledSlices : slices, totalPaid }
}

function ContactFinancialMetricsGrid({
  metrics,
  lastPaymentLabel,
  lastPaymentDate,
  onOpenBalances,
}: {
  metrics: ContactFinancialSummaryPayload["metrics"]
  lastPaymentLabel: string | null
  lastPaymentDate?: string | null
  onOpenBalances: () => void
}) {
  return (
    <DonationMetricCardGrid columns={3} colorful compact className="w-full min-w-0">
      <DonationMetricCard
        title="Total payments received"
        value={formatCurrency(metrics.totalPaid)}
        icon={DollarSign}
        accent="rose"
        compact
      />
      <DonationMetricCard
        title="Outstanding Balance"
        value={formatCurrency(metrics.outstandingBalance)}
        description={
          metrics.outstandingBalance > 0 ? "Click to view open balances" : "No unpaid items"
        }
        icon={Scale}
        accent="amber"
        compact
        onClick={onOpenBalances}
      />
      <DonationMetricCard
        title="Last Payment"
        value={formatDate(lastPaymentDate ?? metrics.lastActivityDate)}
        description={lastPaymentLabel || "No payments yet"}
        icon={Calendar}
        accent="purple"
        compact
      />
    </DonationMetricCardGrid>
  )
}

function ModuleBreakdownChart({
  slices,
  totalPaid,
}: {
  slices: Array<{ key: string; name: string; value: number; color: string }>
  totalPaid: number
}) {
  const chartData = slices.map((slice) => ({
    ...slice,
    fill: slice.color,
  }))
  const hasValues = totalPaid > 0

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Financial by Module</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <div className="relative mx-auto h-[180px] w-[180px] shrink-0">
            <ChartContainer
              config={Object.fromEntries(
                slices.map((slice) => [slice.key, { label: slice.name, color: slice.color }])
              )}
              className="aspect-auto h-full w-full"
            >
              <PieChart>
                <Pie
                  data={
                    hasValues
                      ? chartData.filter((slice) => slice.value > 0)
                      : [{ name: "None", value: 1, fill: "#e2e8f0" }]
                  }
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={hasValues ? 2 : 0}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {(hasValues
                    ? chartData.filter((slice) => slice.value > 0)
                    : [{ fill: "#e2e8f0" }]
                  ).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                {hasValues ? <ChartTooltip content={<ChartTooltipContent />} /> : null}
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(totalPaid)}</p>
              <p className="text-[11px] text-muted-foreground">Payments received</p>
            </div>
          </div>

          <div className="w-full min-w-0 flex-1 space-y-2">
            {slices.map((slice) => {
              const pct = totalPaid > 0 ? Math.round((slice.value / totalPaid) * 100) : 0
              return (
                <div key={slice.key} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {slice.name}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatCurrency(slice.value)} ({pct}%)
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ContactFinancialPanel({
  contactId: contactIdProp,
  contactName: contactNameProp,
  contactEmail: contactEmailProp,
  contactPhone: contactPhoneProp,
  donorId: donorIdProp,
  personId: personIdProp,
  isGroup = false,
  modules: modulesProp,
  variant = "staff",
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
  surface = "full",
}: ContactFinancialPanelProps) {
  const isCustomer = variant === "customer"
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ContactFinancialSummaryPayload | null>(null)
  const [contactId, setContactId] = useState(contactIdProp)
  const [contactName, setContactName] = useState(contactNameProp)
  const [contactEmail, setContactEmail] = useState(contactEmailProp)
  const [contactPhone, setContactPhone] = useState(contactPhoneProp)
  const [donorId, setDonorId] = useState(donorIdProp)
  const [modules, setModules] = useState(modulesProp)
  const [openBalancesOpen, setOpenBalancesOpen] = useState(false)
  const [allTransactionsOpen, setAllTransactionsOpen] = useState(false)
  const [detailTab, setDetailTab] = useState<FinancialDetailTab>("payment-plans")
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsPledgeId, setDetailsPledgeId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setError(null)

    if (isCustomer) {
      const result = await loadCustomerMyTransactionsSummaryAction()
      if (!result.success) {
        setError(result.error)
        setData(null)
      } else {
        setData(result.data)
        setContactId(result.contactId)
        setContactName(result.contactName)
        setContactEmail(result.contactEmail)
        setContactPhone(result.contactPhone)
        setDonorId(result.donorId)
        setModules(result.modules)
      }
    } else {
      const result = await loadContactFinancialSummaryAction({
        contactId: contactIdProp,
        donorId: donorIdProp,
        personId: personIdProp,
        modules: modulesProp,
        isGroup,
      })

      if (!result.success) {
        setError(result.error)
        setData(null)
      } else {
        setData(result.data)
      }
    }

    setLoading(false)
  }, [
    contactIdProp,
    donorIdProp,
    isCustomer,
    isGroup,
    modulesProp,
    personIdProp,
  ])

  useEffect(() => {
    setLoading(true)
    void loadData()
  }, [loadData, refreshToken])

  useEffect(() => {
    if (isCustomer) return
    setContactId(contactIdProp)
    setContactName(contactNameProp)
    setContactEmail(contactEmailProp)
    setContactPhone(contactPhoneProp)
    setDonorId(donorIdProp)
    setModules(modulesProp)
  }, [
    contactEmailProp,
    contactIdProp,
    contactNameProp,
    contactPhoneProp,
    donorIdProp,
    isCustomer,
    modulesProp,
  ])

  const showDonationSidebar = Boolean(modules.donations && donorId) && !isCustomer
  const showPaymentPlansTab = showDonationSidebar && !isGroup
  const showPaymentMethodsTab = showPaymentMethods && !isCustomer
  const showStatementsTab = showDonationSidebar && Boolean(donorId) && !isGroup
  const showPledgesTab = Boolean(modules.donations) && !isGroup && !isCustomer
  const showRefundsTab =
    Boolean(modules.donations || modules.bookings) && !isGroup && !isCustomer
  const showHomepage =
    surface === "full" || surface === "staff-overview"
  const showDetails =
    surface === "full" || surface === "staff-details"
  const showDetailTabsCard =
    showDetails &&
    !isCustomer &&
    !isGroup &&
    (showPaymentPlansTab ||
      showPledgesTab ||
      showRefundsTab ||
      showPaymentMethodsTab ||
      Boolean(modules.donations))
  const showFinancialAside =
    showDetails && !isGroup && surface !== "staff-overview"
  const showFinancialSummaryAside = showFinancialAside && surface === "full"
  const readOnlyTransactions = isCustomer

  const hasAnyModule =
    modules.donations ||
    modules.bookings ||
    modules.programs ||
    modules.membership ||
    modules.vendorHub

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

  const availableDetailTabs = useMemo(() => {
    const tabs: FinancialDetailTab[] = []
    if (showPaymentPlansTab) tabs.push("payment-plans")
    if (showPledgesTab) tabs.push("pledges")
    if (!isGroup) tabs.push("invoices")
    if (showRefundsTab) tabs.push("refunds")
    if (showPaymentMethodsTab) tabs.push("payment-methods")
    return tabs
  }, [isGroup, showPaymentMethodsTab, showPaymentPlansTab, showPledgesTab, showRefundsTab])

  useEffect(() => {
    if (!availableDetailTabs.includes(detailTab)) {
      setDetailTab(availableDetailTabs[0] ?? "invoices")
    }
  }, [availableDetailTabs, detailTab])

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
              <div className={stickyStripClassName}>{contactIdentity}</div>
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
              <div className={stickyStripClassName}>{contactIdentity}</div>
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

  const { metrics, openBalances, timeline } = data
  const transactions = timeline.filter(isPaidTransaction)
  const refunds = timeline.filter(isRefundEvent)
  const lastPayment = transactions[0] ?? null
  const moduleBreakdown = buildModuleBreakdown(timeline, modules)
  const recentTransactions = transactions.slice(0, RECENT_TRANSACTION_LIMIT)

  const donationsPaid = moduleBreakdown.slices.find((s) => s.key === "donations")?.value ?? 0
  const programsPaid = moduleBreakdown.slices.find((s) => s.key === "programs")?.value ?? 0
  const rentalsPaid = moduleBreakdown.slices.find((s) => s.key === "venue_rentals")?.value ?? 0
  const vendorHubPaid = moduleBreakdown.slices.find((s) => s.key === "vendor_hub")?.value ?? 0
  const refundTotal = refunds.reduce((sum, event) => sum + Math.abs(event.amount ?? 0), 0)

  const metricsGrid = !isGroup ? (
    <ContactFinancialMetricsGrid
      metrics={metrics}
      lastPaymentLabel={lastPayment?.eventType ?? null}
      lastPaymentDate={lastPayment?.date ?? null}
      onOpenBalances={() => setOpenBalancesOpen(true)}
    />
  ) : null

  const metricsBlock =
    showHomepage && !isGroup ? (
      <div className="space-y-3">
        <div className="flex justify-end">
          <Select value="all-time" disabled>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-time">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {metricsGrid}
      </div>
    ) : showHomepage && contactIdentity ? (
      contactIdentity
    ) : null

  return (
    <div className="space-y-6">
      {showHomepage && hideIdentity && stickyHeader
        ? renderCombinedSticky(metricsGrid)
        : showHomepage
          ? metricsBlock
          : null}

      {belowSticky}
      {leadingContent}

      {!isGroup && showHomepage ? (
        <Sheet open={openBalancesOpen} onOpenChange={setOpenBalancesOpen}>
          <SheetContent className="flex w-full flex-col sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>Open Balances</SheetTitle>
              <SheetDescription>
                {isCustomer
                  ? "Amounts you still owe or have committed but not fully paid."
                  : `Amounts ${contactName} still owes or has committed but not fully paid.`}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
              <OpenBalancesTable
                rows={openBalances}
                onPledgeClick={
                  isCustomer
                    ? undefined
                    : (pledgeId) => {
                        setDetailsPledgeId(pledgeId)
                        setDetailsOpen(true)
                      }
                }
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      {showHomepage ? (
        <Sheet open={allTransactionsOpen} onOpenChange={setAllTransactionsOpen}>
          <SheetContent className="flex w-full flex-col sm:max-w-3xl">
            <SheetHeader>
              <SheetTitle>All Transactions</SheetTitle>
              <SheetDescription>
                {isCustomer
                  ? "Your full financial timeline."
                  : `Full financial timeline for ${contactName}.`}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
              <FinancialTransactionsTable
                rows={transactions}
                emptyMessage={
                  isCustomer
                    ? "No transactions recorded yet."
                    : "No transactions recorded for this contact yet."
                }
                contactId={contactId}
                contactName={contactName}
                contactEmail={contactEmail}
                onUpdated={() => void loadData()}
                readOnly={readOnlyTransactions}
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      <div
        className={cn(
          "grid gap-6",
          showFinancialAside && "xl:grid-cols-[minmax(0,1fr)_20rem]"
        )}
      >
        <div className="space-y-6">
          {showHomepage && !isGroup ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <ModuleBreakdownChart
                slices={moduleBreakdown.slices}
                totalPaid={moduleBreakdown.totalPaid}
              />
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Recent Transactions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <FinancialTransactionsTable
                    rows={recentTransactions}
                    emptyMessage={
                      isCustomer
                        ? "No transactions recorded yet."
                        : "No transactions recorded for this contact yet."
                    }
                    contactId={contactId}
                    contactName={contactName}
                    contactEmail={contactEmail}
                    onUpdated={() => void loadData()}
                    compact
                    readOnly={readOnlyTransactions}
                  />
                  {transactions.length > 0 ? (
                    <Button
                      variant="ghost"
                      className="h-8 w-full text-sm"
                      onClick={() => setAllTransactionsOpen(true)}
                    >
                      View all transactions
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {showHomepage && !isCustomer ? (
            <ContactFundDevelopmentHistory
              contactId={contactId}
              enabled={Boolean(modules.donations)}
            />
          ) : null}

          {showHomepage && isGroup ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <FinancialTransactionsTable
                  rows={transactions}
                  emptyMessage="No transactions recorded for this group yet."
                  contactId={contactId}
                  contactName={contactName}
                  contactEmail={contactEmail}
                  onUpdated={() => void loadData()}
                />
              </CardContent>
            </Card>
          ) : null}

          {showDetailTabsCard ? (
            <Card>
              <Tabs
                value={detailTab}
                onValueChange={(value) => setDetailTab(value as FinancialDetailTab)}
              >
                <CardHeader className="pb-2 pt-4">
                  <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
                    {showPaymentPlansTab ? (
                      <TabsTrigger value="payment-plans">Recurring</TabsTrigger>
                    ) : null}
                    {showPledgesTab ? <TabsTrigger value="pledges">Pledges</TabsTrigger> : null}
                    <TabsTrigger value="invoices">Invoices</TabsTrigger>
                    {showRefundsTab ? <TabsTrigger value="refunds">Refunds</TabsTrigger> : null}
                    {showPaymentMethodsTab ? (
                      <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
                    ) : null}
                  </TabsList>
                </CardHeader>
                <CardContent className="pt-3">
                  {showPaymentPlansTab && donorId ? (
                    <TabsContent value="payment-plans" className="mt-0">
                      <DonationRecurringPanel
                        embedded
                        donorId={donorId}
                        onUpdated={() => void loadData()}
                      />
                    </TabsContent>
                  ) : null}

                  {showPledgesTab ? (
                    <TabsContent value="pledges" className="mt-0">
                      {donorId ? (
                        <DonorPledgesTab
                          donorId={donorId}
                          donorName={contactName}
                          contactId={contactId}
                          embedded
                          onUpdated={() => void loadData()}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">There are no pledges.</p>
                      )}
                    </TabsContent>
                  ) : null}

                  <TabsContent value="invoices" className="mt-0">
                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                      <FileText className="h-8 w-8 text-muted-foreground/60" />
                      <p className="text-sm font-medium">No invoices</p>
                      <p className="max-w-sm text-xs text-muted-foreground">
                        Invoice history for this contact will appear here when billing invoices are
                        linked.
                      </p>
                    </div>
                  </TabsContent>

                  {showRefundsTab ? (
                    <TabsContent value="refunds" className="mt-0">
                      <FinancialTransactionsTable
                        rows={refunds}
                        emptyMessage="No refunds recorded for this contact."
                        contactId={contactId}
                        contactName={contactName}
                        contactEmail={contactEmail}
                        onUpdated={() => void loadData()}
                      />
                    </TabsContent>
                  ) : null}

                  {showPaymentMethodsTab ? (
                    <TabsContent value="payment-methods" className="mt-0">
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
                    </TabsContent>
                  ) : null}
                </CardContent>
              </Tabs>
            </Card>
          ) : null}

          {showDetails ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0" />
              {isCustomer
                ? "All financial information is associated with your account."
                : `All financial information is associated with ${contactName}.`}
            </p>
          ) : null}

          {trailingContent}
        </div>

        {showFinancialAside ? (
          <aside className="space-y-4">
            {showFinancialSummaryAside ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Financial Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {modules.donations ? (
                  <SummaryRow label="Donations" value={formatCurrency(donationsPaid)} />
                ) : null}
                {modules.programs ? (
                  <SummaryRow label="Program Payments" value={formatCurrency(programsPaid)} />
                ) : null}
                {modules.bookings ? (
                  <SummaryRow label="Venue Rentals" value={formatCurrency(rentalsPaid)} />
                ) : null}
                {modules.vendorHub ? (
                  <SummaryRow label="Vendor Hub" value={formatCurrency(vendorHubPaid)} />
                ) : null}
                <SummaryRow
                  label="Total Paid"
                  value={formatCurrency(metrics.totalPaid)}
                  valueClassName="text-emerald-600"
                />
                {showRefundsTab ? (
                  <SummaryRow
                    label="Refunds"
                    value={formatCurrency(refundTotal)}
                    valueClassName={refundTotal > 0 ? "text-rose-600" : undefined}
                  />
                ) : null}
                <SummaryRow
                  label="Outstanding Balance"
                  value={formatCurrency(metrics.outstandingBalance)}
                  valueClassName={
                    metrics.outstandingBalance > 0 ? "text-amber-600" : undefined
                  }
                />
                <Button
                  variant="ghost"
                  className="h-8 w-full justify-start px-0 text-sm text-primary"
                  onClick={() => setOpenBalancesOpen(true)}
                >
                  View open balances
                </Button>
              </CardContent>
            </Card>
            ) : null}

            {showPaymentMethodsTab ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">Payment Methods</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setDetailTab("payment-methods")}
                  >
                    + Add
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {paymentMethodsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </div>
                  ) : paymentMethods.length === 0 ? (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CreditCard className="mt-0.5 h-4 w-4 shrink-0" />
                      No payment methods on file.
                    </div>
                  ) : (
                    <ContactPaymentMethodsPanel
                      contactId={contactId}
                      paymentMethods={paymentMethods.slice(0, 2)}
                      compact
                      embedded
                    />
                  )}
                  <Button
                    variant="ghost"
                    className="h-8 w-full justify-start px-0 text-sm text-primary"
                    onClick={() => setDetailTab("payment-methods")}
                  >
                    Manage payment methods
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {showStatementsTab && donorId ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Statements</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Generate, preview, download, or email annual giving statements.
                  </p>
                  <GivingStatementActions donorId={donorId} donorName={contactName} />
                </CardContent>
              </Card>
            ) : null}

            {modules.membership ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Membership</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Membership dues and billing history will appear here when membership financial
                  records are linked to contacts.
                </CardContent>
              </Card>
            ) : null}
          </aside>
        ) : null}
      </div>
      {!isCustomer ? (
        <PledgeDetailsDialog
          open={detailsOpen}
          onOpenChange={(open) => {
            setDetailsOpen(open)
            if (!open) setDetailsPledgeId(null)
          }}
          pledgeId={detailsPledgeId}
          onSaved={() => {
            void loadData()
          }}
          onDeleted={() => {
            setDetailsOpen(false)
            setDetailsPledgeId(null)
            void loadData()
          }}
        />
      ) : null}
    </div>
  )
}

function SummaryRow({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium tabular-nums", valueClassName)}>{value}</span>
    </div>
  )
}

function FinancialTransactionsTable({
  rows,
  emptyMessage,
  contactId: _contactId,
  contactName,
  contactEmail,
  onUpdated,
  compact = false,
  readOnly = false,
}: {
  rows: ContactFinancialTimelineEvent[]
  emptyMessage: string
  contactId: string
  contactName: string
  contactEmail?: string | null
  onUpdated?: () => void
  compact?: boolean
  readOnly?: boolean
}) {
  const router = useRouter()
  const [openingPaymentId, setOpeningPaymentId] = useState<string | null>(null)
  const [paymentEdit, setPaymentEdit] = useState<{
    donorId: string
    row: DonationHistoryRow
    initialDialog: "edit" | "allocate"
  } | null>(null)

  const openPaymentEditor = useCallback(
    async (paymentId: string, initialDialog: "edit" | "allocate" = "edit") => {
      if (readOnly) return
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
    [readOnly]
  )

  const handleTimelineDateClick = useCallback(
    (event: ContactFinancialTimelineEvent) => {
      if (readOnly) return
      const paymentId = getTimelinePaymentId(event)
      if (paymentId) {
        void openPaymentEditor(paymentId)
        return
      }

      if (event.href) {
        router.push(event.href)
      }
    },
    [openPaymentEditor, readOnly, router]
  )

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  const showActions = !compact && !readOnly

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              {showActions ? (
                <TableHead className="w-[1%] text-right">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((event) => {
              const editable = !readOnly && isTimelineEventEditable(event)
              const paymentId = getTimelinePaymentId(event)
              const isOpening = paymentId != null && openingPaymentId === paymentId
              const actionRow = event.paymentActionRow
                ? mapPaymentToDonationHistoryRow(event.paymentActionRow)
                : null

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
                  <TableCell className="max-w-[200px] truncate font-medium">
                    {event.description}
                  </TableCell>
                  <TableCell className="text-right">
                    {event.amount != null ? formatCurrency(event.amount) : "—"}
                  </TableCell>
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
                  {showActions ? (
                    <TableCell className="text-right">
                      <ContactTransactionRowActions
                        event={event}
                        contactName={contactName}
                        contactEmail={contactEmail}
                        donationRow={actionRow}
                        onLinkToPledge={
                          paymentId
                            ? () => void openPaymentEditor(paymentId, "allocate")
                            : undefined
                        }
                        onUpdated={() => onUpdated?.()}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {!readOnly && paymentEdit ? (
        <ContactFinancialPaymentEditDialog
          donorId={paymentEdit.donorId}
          donation={paymentEdit.row}
          initialDialog={paymentEdit.initialDialog}
          onClosed={() => setPaymentEdit(null)}
          onUpdated={() => {
            setPaymentEdit(null)
            onUpdated?.()
          }}
        />
      ) : null}
    </>
  )
}

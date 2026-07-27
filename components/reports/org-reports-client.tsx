"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  CreditCard,
  Loader2,
  Sparkles,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { financialActivityStatusBadgeClass } from "@/lib/donations/donation-status"
import {
  fetchOrgPaymentTransactionsAction,
  type OrgPaymentTransactionRow,
} from "@/lib/reports/org-payment-transactions"
import { cn } from "@/lib/utils"

const REPORT_TABS = [
  { value: "payments", label: "Payment transactions" },
  { value: "failed", label: "Failed transactions" },
  { value: "more", label: "More reports" },
] as const

type ReportTab = (typeof REPORT_TABS)[number]["value"]

function isReportTab(value: string | null): value is ReportTab {
  return REPORT_TABS.some((tab) => tab.value === value)
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function PaymentTransactionsTable({
  rows,
  emptyMessage,
}: {
  rows: OrgPaymentTransactionRow[]
  emptyMessage: string
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Person</TableHead>
            <TableHead>Module</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{formatDate(row.paidAt)}</TableCell>
              <TableCell>
                {row.detailHref ? (
                  <Link
                    href={row.detailHref}
                    className="font-medium text-sky-600 hover:underline"
                  >
                    {row.partyName}
                  </Link>
                ) : (
                  <span className="font-medium">{row.partyName}</span>
                )}
                {row.failureHint ? (
                  <div className="text-xs text-destructive">{row.failureHint}</div>
                ) : null}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{row.moduleLabel}</Badge>
              </TableCell>
              <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
                {row.description || "—"}
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={cn(
                    "rounded-full",
                    financialActivityStatusBadgeClass(row.status)
                  )}
                >
                  {row.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(row.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function useOrgPaymentRows(failedOnly: boolean) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<OrgPaymentTransactionRow[]>([])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const result = await fetchOrgPaymentTransactionsAction({
        failedOnly,
        limit: 400,
      })
      if (cancelled) return
      if (!result.success) {
        setError(result.error)
        setRows([])
      } else {
        setRows(result.rows)
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [failedOnly])

  return { loading, error, rows }
}

function PaymentsTab({ failedOnly }: { failedOnly: boolean }) {
  const { loading, error, rows } = useOrgPaymentRows(failedOnly)

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading transactions…
      </div>
    )
  }

  if (error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          {failedOnly ? (
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          ) : (
            <CreditCard className="h-5 w-5" />
          )}
          {failedOnly ? "Failed transactions" : "Payment transactions"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {failedOnly
            ? "Declined cards, voided payments, and other failed payment attempts across the organization."
            : "Organization-wide payments from Donations and Programs."}
        </p>
      </div>
      <PaymentTransactionsTable
        rows={rows}
        emptyMessage={
          failedOnly
            ? "No failed payment transactions found."
            : "No payment transactions yet."
        }
      />
    </div>
  )
}

export function OrgReportsClient({
  initialTab = "payments",
  basePath = "/finance/transactions",
}: {
  initialTab?: string
  /** Path used for tab URL sync (Finance Transactions or legacy /reports). */
  basePath?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get("tab")
  const activeTab: ReportTab = isReportTab(tabFromUrl)
    ? tabFromUrl
    : isReportTab(initialTab)
      ? initialTab
      : "payments"

  function selectTab(value: string) {
    const next = isReportTab(value) ? value : "payments"
    const params = new URLSearchParams(searchParams.toString())
    if (next === "payments") {
      params.delete("tab")
    } else {
      params.set("tab", next)
    }
    const query = params.toString()
    router.replace(query ? `${basePath}?${query}` : basePath)
  }

  return (
    <Tabs value={activeTab} onValueChange={selectTab} className="gap-4">
      <TabsList>
        {REPORT_TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="payments" className="mt-0">
        <PaymentsTab failedOnly={false} />
      </TabsContent>

      <TabsContent value="failed" className="mt-0">
        <PaymentsTab failedOnly />
      </TabsContent>

      <TabsContent value="more" className="mt-0">
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">
                More reports coming soon
              </h2>
              <p className="max-w-md text-sm text-muted-foreground">
                This organization-wide Reports hub will grow as we add cross-module
                analytics. Tell us what you need next.
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}

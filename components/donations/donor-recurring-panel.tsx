"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getDonorRecurringSummaryAction } from "@/lib/donations/recurring-donation-actions"
import {
  formatRecurringFrequencyLabel,
  formatRecurringStatusLabel,
} from "@/lib/donations/recurring-donation-types"

type DonorRecurringPanelProps = {
  donorId: string
  /** Render without an outer Card (e.g. inside Financial Activity tabs). */
  embedded?: boolean
  /** Called after load so a parent section can collapse when empty. */
  onHasPlansChange?: (info: { hasPlans: boolean; count: number }) => void
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function DonorRecurringPanel({
  donorId,
  embedded = false,
  onHasPlansChange,
}: DonorRecurringPanelProps) {
  const [summary, setSummary] = useState<Awaited<
    ReturnType<typeof getDonorRecurringSummaryAction>
  > | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const result = await getDonorRecurringSummaryAction(donorId)
      setSummary(result)
      setLoading(false)
      if (!result.success) {
        onHasPlansChange?.({ hasPlans: false, count: 0 })
        return
      }
      const count = result.summary.activePlans.length + result.summary.paymentHistory.length
      onHasPlansChange?.({ hasPlans: count > 0, count })
    }
    load()
  }, [donorId, onHasPlansChange])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading payment plans...
      </div>
    )
  }

  if (!summary?.success) {
    return embedded ? (
      <p className="text-sm text-muted-foreground">Could not load payment plans.</p>
    ) : null
  }

  const data = summary.summary
  const hasPlans = data.activePlans.length > 0 || data.paymentHistory.length > 0

  if (!hasPlans) {
    return embedded ? (
      <p className="text-sm text-muted-foreground">
        No payment plans yet. Recurring donations and other scheduled payments will appear here.
      </p>
    ) : null
  }

  const description = (
    <>
      Scheduled and recurring payments — donations today; program fees and other modules when
      enabled. Lifetime recurring giving: {formatCurrency(data.lifetimeRecurringGiving)}
    </>
  )

  const plansContent = (
    <div className="space-y-4">
      {data.activePlans.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Next Payment</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.activePlans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell>{plan.campaign_name || "—"}</TableCell>
                <TableCell>{formatCurrency(plan.amount)}</TableCell>
                <TableCell>{formatRecurringFrequencyLabel(plan.frequency)}</TableCell>
                <TableCell>{formatDate(plan.next_payment_date)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{formatRecurringStatusLabel(plan.status)}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      {data.paymentHistory.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-medium">Payment history</p>
          <div className="space-y-2">
            {data.paymentHistory.slice(0, 5).map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>{formatDate(payment.payment_date)}</span>
                <span className="font-medium">{formatCurrency(payment.amount)}</span>
                <span className="text-muted-foreground capitalize">{payment.source || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )

  if (embedded) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        {plansContent}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payment Plans</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{plansContent}</CardContent>
    </Card>
  )
}

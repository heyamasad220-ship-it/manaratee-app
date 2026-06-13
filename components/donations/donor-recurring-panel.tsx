"use client"

import { useEffect, useState } from "react"
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
import { Button } from "@/components/ui/button"
import { getDonorRecurringSummaryAction } from "@/lib/donations/recurring-donation-actions"
import {
  formatRecurringFrequencyLabel,
  formatRecurringStatusLabel,
} from "@/lib/donations/recurring-donation-types"

type DonorRecurringPanelProps = {
  donorId: string
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

export function DonorRecurringPanel({ donorId }: DonorRecurringPanelProps) {
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
    }
    load()
  }, [donorId])

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading recurring donations...</div>
  }

  if (!summary?.success) return null
  const data = summary.summary

  if (data.activePlans.length === 0 && data.paymentHistory.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recurring Donations</CardTitle>
        <CardDescription>
          Ongoing giving plans — separate from pledges. Lifetime recurring:{" "}
          {formatCurrency(data.lifetimeRecurringGiving)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.activePlans.length > 0 && (
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
        )}

        {data.paymentHistory.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Recurring Payment History</p>
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
        )}
      </CardContent>
    </Card>
  )
}

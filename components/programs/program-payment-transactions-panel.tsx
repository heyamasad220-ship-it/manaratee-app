"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  fetchProgramPaymentTransactionsAction,
  type ProgramPaymentTransactionRow,
} from "@/lib/programs/program-payment-transactions"
import { cn } from "@/lib/utils"

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

function statusClass(status: ProgramPaymentTransactionRow["status"]) {
  switch (status) {
    case "Succeeded":
      return "border-emerald-200 bg-emerald-50 text-emerald-800"
    case "Refunded":
      return "border-amber-200 bg-amber-50 text-amber-900"
    default:
      return "border-red-200 bg-red-50 text-red-800"
  }
}

/** Reports → Payment transactions (pipeline step 1). */
export function ProgramPaymentTransactionsPanel() {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<ProgramPaymentTransactionRow[]>([])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const result = await fetchProgramPaymentTransactionsAction({ limit: 200 })
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
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading payment transactions…
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

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        No program payment transactions yet.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Payment transactions
        </h2>
        <p className="text-sm text-muted-foreground">
          Paid and refunded program charge schedule rows (ledger view).
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Participant</TableHead>
              <TableHead>Program / Offering</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{formatDate(row.paidAt)}</TableCell>
                <TableCell>
                  <Link
                    href={`/programs/registrations/${row.enrollmentId}`}
                    className="font-medium text-sky-600 hover:underline"
                  >
                    {row.participantName}
                  </Link>
                  {row.label ? (
                    <div className="text-xs text-muted-foreground">
                      {row.label}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="text-sm">{row.programName}</div>
                  {row.offeringName ? (
                    <div className="text-xs text-muted-foreground">
                      {row.offeringName}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn("rounded-full", statusClass(row.status))}
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
    </div>
  )
}

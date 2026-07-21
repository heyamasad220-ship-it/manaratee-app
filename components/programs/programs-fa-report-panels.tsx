"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type EnrollmentLite = {
  child_name?: string | null
  program?: { name?: string | null } | null
}

type FinancialAssistanceRow = {
  id: string
  status: string
  requested_amount: number | null
  approved_amount: number | null
  enrollment?: EnrollmentLite | null
}

type PaymentPlanRow = {
  id: string
  installment_amount: number | null
  due_date: string | null
  status: string
  enrollment?: EnrollmentLite | null
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getStatusBadge(status: string) {
  switch (status) {
    case "confirmed":
    case "approved":
    case "paid":
    case "converted":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
          {status}
        </Badge>
      )
    case "pending":
    case "waiting":
      return (
        <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">{status}</Badge>
      )
    case "offered":
      return (
        <Badge className="bg-violet-500/10 text-violet-600 hover:bg-violet-500/20">{status}</Badge>
      )
    case "cancelled":
    case "denied":
    case "expired":
    case "late":
      return <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20">{status}</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function MetricCard({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: React.ReactNode
  valueClassName?: string
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="space-y-2 p-5">
        <CardDescription className="text-sm">{label}</CardDescription>
        <CardTitle className={cn("text-3xl font-bold tracking-tight", valueClassName)}>
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

function SimpleTable({
  loading,
  empty,
  headers,
  rows,
}: {
  loading: boolean
  empty: string
  headers: string[]
  rows: React.ReactNode[][]
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={headers.length} className="py-10 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length} className="py-10 text-center text-muted-foreground">
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={index}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={cellIndex}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

const enrollmentSelect = `
  *,
  enrollment:enrollment_id (
    *,
    program:program_id (
      id,
      name
    )
  )
`

export function FinancialAssistanceReportPanel() {
  const supabase = createClient()
  const [loading, setLoading] = React.useState(true)
  const [items, setItems] = React.useState<FinancialAssistanceRow[]>([])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from("program_financial_assistance")
        .select(enrollmentSelect)
      if (!cancelled) {
        if (error) {
          console.warn("program_financial_assistance could not be loaded:", error.message)
          setItems([])
        } else {
          setItems((data || []) as FinancialAssistanceRow[])
        }
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const totalRequested = items.reduce((sum, item) => sum + Number(item.requested_amount || 0), 0)
  const totalApproved = items.reduce((sum, item) => sum + Number(item.approved_amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Applications" value={items.length} />
        <MetricCard label="Requested" value={formatCurrency(totalRequested)} />
        <MetricCard
          label="Approved"
          value={formatCurrency(totalApproved)}
          valueClassName="text-emerald-500"
        />
      </div>

      <SimpleTable
        loading={loading}
        empty="No financial assistance applications found."
        headers={["Participant", "Program", "Requested", "Approved", "Status"]}
        rows={items.map((item) => [
          item.enrollment?.child_name || "-",
          item.enrollment?.program?.name || "-",
          formatCurrency(item.requested_amount),
          formatCurrency(item.approved_amount),
          getStatusBadge(item.status),
        ])}
      />
    </div>
  )
}

export function PaymentPlansReportPanel() {
  const supabase = createClient()
  const [loading, setLoading] = React.useState(true)
  const [items, setItems] = React.useState<PaymentPlanRow[]>([])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from("program_payment_plans")
        .select(enrollmentSelect)
        .order("due_date")
      if (!cancelled) {
        if (error) {
          console.warn("program_payment_plans could not be loaded:", error.message)
          setItems([])
        } else {
          setItems((data || []) as PaymentPlanRow[])
        }
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const outstanding = items
    .filter((item) => item.status !== "paid")
    .reduce((sum, item) => sum + Number(item.installment_amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Installments" value={items.length} />
        <MetricCard
          label="Outstanding"
          value={formatCurrency(outstanding)}
          valueClassName="text-amber-500"
        />
        <MetricCard
          label="Late"
          value={items.filter((item) => item.status === "late").length}
          valueClassName="text-red-500"
        />
      </div>

      <SimpleTable
        loading={loading}
        empty="No payment plan installments found."
        headers={["Participant", "Program", "Amount", "Due Date", "Status"]}
        rows={items.map((item) => [
          item.enrollment?.child_name || "-",
          item.enrollment?.program?.name || "-",
          formatCurrency(item.installment_amount),
          formatDate(item.due_date),
          getStatusBadge(item.status),
        ])}
      />
    </div>
  )
}

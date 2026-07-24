"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { Baby, Loader2, Wallet } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { departmentGroupWorkspaceHref } from "@/lib/donations/donation-group-path"
import {
  fetchFinancePayrollQueueAction,
  markFinancePayrollPaidAction,
  type FinancePayrollQueueRow,
} from "@/lib/finance/org-payroll-queue"
import { cn } from "@/lib/utils"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPeriod(row: FinancePayrollQueueRow) {
  const fmt = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  return `${fmt(row.periodStart)} – ${fmt(row.periodEnd)}`
}

export function FinancePayrollQueuePanel() {
  const [statusTab, setStatusTab] = useState<"approved" | "paid" | "all">("approved")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<FinancePayrollQueueRow[]>([])
  const [canManage, setCanManage] = useState(false)
  const [migrationRequired, setMigrationRequired] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchFinancePayrollQueueAction({ status: statusTab })
    if (!result.success) {
      setError(result.error)
      setRows([])
      setCanManage(false)
      setMigrationRequired(false)
      setSelectedIds([])
    } else {
      setRows(result.rows)
      setCanManage(result.canManage)
      setMigrationRequired(result.migrationRequired)
      setSelectedIds((current) =>
        current.filter((id) => result.rows.some((row) => row.id === id))
      )
    }
    setLoading(false)
  }, [statusTab])

  useEffect(() => {
    void load()
  }, [load])

  const approvedRows = useMemo(
    () => rows.filter((row) => row.status === "approved"),
    [rows]
  )
  const payableSelected = selectedIds.filter((id) =>
    approvedRows.some((row) => row.id === id)
  )
  const allApprovedSelected =
    approvedRows.length > 0 &&
    approvedRows.every((row) => selectedIds.includes(row.id))

  const totals = useMemo(() => {
    const amount = rows.reduce((sum, row) => sum + row.amount, 0)
    const childcare = rows.filter((row) => row.isChildcareProvider).length
    return {
      count: rows.length,
      amount,
      childcare,
      ready: approvedRows.length,
    }
  }, [rows, approvedRows])

  function toggleAllApproved(checked: boolean) {
    if (!checked) {
      setSelectedIds((current) =>
        current.filter((id) => !approvedRows.some((row) => row.id === id))
      )
      return
    }
    setSelectedIds((current) => [
      ...new Set([...current, ...approvedRows.map((row) => row.id)]),
    ])
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, id] : current.filter((value) => value !== id)
    )
  }

  function handleMarkPaid() {
    if (payableSelected.length === 0) return
    startTransition(async () => {
      const result = await markFinancePayrollPaidAction({
        entryIds: payableSelected,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setSelectedIds([])
      await load()
    })
  }

  return (
    <div className="space-y-6">
      {!loading && !error ? (
        <StatCardsRow equal columns={4}>
          <StatCard
            layout="header"
            fill
            tone="blue"
            label="Rows"
            value={totals.count}
            icon={Wallet}
            hint={statusTab === "approved" ? "Ready to pay" : "In this view"}
          />
          <StatCard
            layout="header"
            fill
            tone="emerald"
            label="Amount"
            value={formatCurrency(totals.amount)}
            icon={Wallet}
            hint="Sum of listed pay entries"
          />
          <StatCard
            layout="header"
            fill
            tone="violet"
            label="Childcare"
            value={totals.childcare}
            icon={Baby}
            hint="Provider pay lines"
          />
          <StatCard
            layout="header"
            fill
            tone="amber"
            label="Ready"
            value={totals.ready}
            icon={Wallet}
            hint="Approved, not yet paid"
          />
        </StatCardsRow>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4" />
              Payroll queue
            </CardTitle>
            <CardDescription>
              Approved department payroll (teachers and childcare providers) ready
              to mark paid. SaaS subscription Billing stays under Billing in the
              sidebar footer.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={statusTab}
              onValueChange={(value) =>
                setStatusTab(value as "approved" | "paid" | "all")
              }
            >
              <TabsList>
                <TabsTrigger value="approved">Ready to pay</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
            {canManage ? (
              <Button
                type="button"
                size="sm"
                disabled={payableSelected.length === 0 || isPending}
                onClick={handleMarkPaid}
              >
                {isPending
                  ? "Saving…"
                  : `Mark paid${payableSelected.length ? ` (${payableSelected.length})` : ""}`}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {migrationRequired ? (
            <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Run <code className="text-xs">scripts/187_finance_module_and_payroll_paid.sql</code>{" "}
              in Supabase to enable Mark paid.
            </p>
          ) : null}
          {loading ? (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading payroll queue…
            </p>
          ) : error ? (
            <p className="py-6 text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No pay entries in this view. Department heads approve payroll first;
              approved lines appear here.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {canManage ? (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allApprovedSelected}
                          onCheckedChange={(checked) =>
                            toggleAllApproved(checked === true)
                          }
                          aria-label="Select all ready-to-pay rows"
                          disabled={approvedRows.length === 0 || isPending}
                        />
                      </TableHead>
                    ) : null}
                    <TableHead>Worker</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const selectable = row.status === "approved" && canManage
                    return (
                      <TableRow key={row.id}>
                        {canManage ? (
                          <TableCell>
                            {selectable ? (
                              <Checkbox
                                checked={selectedIds.includes(row.id)}
                                onCheckedChange={(checked) =>
                                  toggleOne(row.id, checked === true)
                                }
                                aria-label={`Select ${row.workerName}`}
                                disabled={isPending}
                              />
                            ) : null}
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <div className="font-medium">{row.workerName}</div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            {row.positionName || row.payBasis || "Staff"}
                            {row.isChildcareProvider ? (
                              <Badge variant="secondary" className="font-normal">
                                Childcare
                              </Badge>
                            ) : null}
                          </div>
                          {row.eventLabels.length > 0 ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Events: {row.eventLabels.join(", ")}
                            </div>
                          ) : row.notes ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {row.notes}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={departmentGroupWorkspaceHref(row.departmentId, {
                              tab: "financial",
                              finance: "payroll",
                            })}
                            className="text-primary hover:underline"
                          >
                            {row.departmentName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatPeriod(row)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {row.hoursWorked == null ? "—" : row.hoursWorked}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCurrency(row.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "font-normal capitalize",
                              row.status === "paid"
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-amber-50 text-amber-900"
                            )}
                          >
                            {row.status === "paid" ? "Paid" : "Ready to pay"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

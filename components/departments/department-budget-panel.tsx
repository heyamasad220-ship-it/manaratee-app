"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Loader2, PieChart, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  createDepartmentBudgetPeriodAction,
  deleteDepartmentBudgetPeriodAction,
  fetchDepartmentBudgetAction,
  type DepartmentBudgetSummary,
} from "@/lib/departments/department-budget"
import { cn } from "@/lib/utils"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function DepartmentBudgetPanel({
  departmentId,
  departmentName,
}: {
  departmentId: string
  departmentName: string
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<DepartmentBudgetSummary | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentBudgetAction(departmentId)
    if (!result.success) {
      setError(result.error)
      setSummary(null)
    } else {
      setSummary(result.summary)
    }
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    void load()
  }, [load])

  const periods = summary?.periods ?? summary?.byMonth ?? []

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="size-4" />
              Financial Summary
            </CardTitle>
            <CardDescription>
              Student payments (from Programs billing) minus approved payroll for {departmentName}.
              Add periods with start and end dates for this year. Directors see revenue totals here
              without student-level payment details. Separate from Group giving donations.
            </CardDescription>
          </div>
          {summary?.canManage ? (
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Add period
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading financial summary...
            </p>
          ) : error ? (
            <p className="py-6 text-sm text-destructive">{error}</p>
          ) : !summary ? null : periods.length === 0 ? (
            <>
              {summary.migrationRequired ? (
                <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Run <code className="text-xs">scripts/173_department_budget_periods.sql</code> in
                  Supabase, then add periods with start and end dates.
                </p>
              ) : null}
              <p className="py-8 text-center text-sm text-muted-foreground">
                No periods yet. Add a period with the start and end dates for this year
                (for example Aug 17–Aug 31).
              </p>
            </>
          ) : (
            <>
              {summary.migrationRequired ? (
                <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Some ledgers need migrations. Totals may be incomplete until those scripts are
                  applied.
                </p>
              ) : null}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Student payments</TableHead>
                      <TableHead className="text-right">Payroll</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      {summary.canManage ? <TableHead className="w-[72px]" /> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periods.map((period) => (
                      <TableRow key={period.id || period.label}>
                        <TableCell className="font-medium">{period.label}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(period.studentTuition)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatCurrency(period.teacherSalaries)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums font-medium",
                            period.profit < 0 ? "text-red-700" : "text-emerald-700"
                          )}
                        >
                          {formatCurrency(period.profit)}
                        </TableCell>
                        {summary.canManage ? (
                          <TableCell>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 text-muted-foreground hover:text-destructive"
                              disabled={isPending}
                              aria-label="Delete period"
                              onClick={() => {
                                startTransition(async () => {
                                  const result = await deleteDepartmentBudgetPeriodAction({
                                    departmentId,
                                    periodId: period.id,
                                  })
                                  if (!result.success) {
                                    setError(result.error)
                                    return
                                  }
                                  await load()
                                })
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(summary.totals.studentTuition)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatCurrency(summary.totals.teacherSalaries)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          summary.totals.profit < 0 ? "text-red-700" : "text-emerald-700"
                        )}
                      >
                        {formatCurrency(summary.totals.profit)}
                      </TableCell>
                      {summary.canManage ? <TableCell /> : null}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <CreateBudgetPeriodDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        departmentId={departmentId}
        onSaved={async () => {
          setCreateOpen(false)
          await load()
        }}
      />
    </>
  )
}

function CreateBudgetPeriodDialog({
  open,
  onOpenChange,
  departmentId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  departmentId: string
  onSaved: () => Promise<void>
}) {
  const [periodStart, setPeriodStart] = useState("2026-08-17")
  const [periodEnd, setPeriodEnd] = useState("2026-08-31")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!periodStart || !periodEnd) {
      setError("Enter a start and end date.")
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createDepartmentBudgetPeriodAction({
        departmentId,
        periodStart,
        periodEnd,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      await onSaved()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add period</DialogTitle>
          <DialogDescription>
            Set the start and end dates for this period. Dates change each year (for example the
            academic year start Aug 17–Aug 31).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="budget-period-start">Start date</Label>
              <Input
                id="budget-period-start"
                type="date"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-period-end">End date</Label>
              <Input
                id="budget-period-end"
                type="date"
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
                disabled={isPending}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Add period"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

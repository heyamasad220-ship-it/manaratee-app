"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Check, Clock, FileText, Loader2, Pencil, Plus, Send, Trash2, Users, Wallet, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  approvePayPeriodAction,
  createPayPeriodForAllEmployeesAction,
  deletePayPeriodEntryAction,
  fetchDepartmentPayrollListAction,
  fetchStaffHourLogsAction,
  listPayrollHourLogOptionsAction,
  logDepartmentStaffHoursAction,
  submitPayPeriodAction,
  updatePayPeriodEntryAction,
  type DepartmentHourLogRow,
  type DepartmentPayPeriodRow,
  type PayrollDepartmentOption,
  type PayrollStaffOption,
} from "@/lib/departments/department-payroll"
import { cn } from "@/lib/utils"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatPeriodRange(start: string, end: string) {
  return `${formatDate(start)} – ${formatDate(end)}`
}

function statusBadge(status: DepartmentPayPeriodRow["status"]) {
  const styles: Record<DepartmentPayPeriodRow["status"], string> = {
    draft: "bg-muted text-muted-foreground",
    pending: "bg-amber-100 text-amber-900",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-800",
    paid: "bg-sky-100 text-sky-900",
  }
  const labels: Record<DepartmentPayPeriodRow["status"], string> = {
    draft: "Draft",
    pending: "Pending approval",
    approved: "Approved",
    rejected: "Rejected",
    paid: "Paid",
  }
  return (
    <Badge variant="secondary" className={cn("font-normal capitalize", styles[status])}>
      {labels[status]}
    </Badge>
  )
}

export function DepartmentPayrollPanel({
  departmentId,
  departmentName,
}: {
  departmentId: string
  departmentName: string
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<DepartmentPayPeriodRow[]>([])
  const [canApprove, setCanApprove] = useState(false)
  const [selfStaffId, setSelfStaffId] = useState<string | null>(null)
  const [migrationRequired, setMigrationRequired] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [salaryOpen, setSalaryOpen] = useState(false)
  const [editRow, setEditRow] = useState<DepartmentPayPeriodRow | null>(null)
  const [detailRow, setDetailRow] = useState<DepartmentPayPeriodRow | null>(null)
  const [detailLogs, setDetailLogs] = useState<DepartmentHourLogRow[]>([])
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentPayrollListAction(departmentId)
    if (!result.success) {
      setError(result.error)
      setRows([])
      setLoading(false)
      return
    }
    setRows(result.rows)
    setCanApprove(result.canApprove)
    setSelfStaffId(result.selfStaffId)
    setMigrationRequired(result.migrationRequired)
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    void load()
  }, [load])

  async function openDetail(row: DepartmentPayPeriodRow) {
    setDetailRow(row)
    if (row.payBasis === "hourly") {
      const logs = await fetchStaffHourLogsAction({
        departmentId,
        staffId: row.staffId,
        periodKey: row.periodKey,
      })
      if (logs.success) setDetailLogs(logs.logs)
      else setDetailLogs([])
    } else {
      setDetailLogs([])
    }
  }

  function runAction(action: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action()
      if (!result.success) {
        setError(result.error || "Something went wrong.")
        return
      }
      setError(null)
      await load()
    })
  }

  const pendingCount = rows.filter((row) => row.status === "pending").length
  const draftCount = rows.filter((row) => row.status === "draft").length
  const approvedTotal = rows
    .filter((row) => row.status === "approved" || row.status === "paid")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const hoursTotal = rows
    .filter((row) => row.payBasis === "hourly")
    .reduce((sum, row) => sum + Number(row.hoursWorked || 0), 0)
  const childcareCount = rows.filter((row) => row.isChildcareProvider).length

  return (
    <div className="space-y-6">
      {!loading && !error ? (
        <StatCardsRow equal columns={6}>
          <StatCard
            layout="header"
            fill
            tone="blue"
            label="Pay lines"
            value={rows.length}
            icon={Wallet}
            hint="All period rows"
          />
          <StatCard
            layout="header"
            fill
            tone="amber"
            label="Pending"
            value={pendingCount}
            icon={Send}
            hint="Awaiting approval"
          />
          <StatCard
            layout="header"
            fill
            tone="emerald"
            label="Approved"
            value={formatCurrency(approvedTotal)}
            icon={Check}
            hint="Approved pay total"
          />
          <StatCard
            layout="header"
            fill
            tone="slate"
            label="Draft"
            value={draftCount}
            icon={FileText}
            hint="Not submitted"
          />
          <StatCard
            layout="header"
            fill
            tone="sky"
            label="Hours"
            value={Math.round(hoursTotal * 10) / 10}
            icon={Clock}
            hint="Hourly rows"
          />
          <StatCard
            layout="header"
            fill
            tone="violet"
            label="Childcare"
            value={childcareCount}
            icon={Users}
            hint="Provider lines"
          />
        </StatCardsRow>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4" />
              Payroll
            </CardTitle>
            <CardDescription>
              Teachers and childcare providers log hours by date (providers pick which department
              the hours belong to). Department heads create a pay period for everyone and approve
              lines for {departmentName}.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => setLogOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Log hours
            </Button>
            {canApprove ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSalaryOpen(true)}
              >
                Create pay period
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading payroll...
            </p>
          ) : error ? (
            <p className="py-4 text-sm text-destructive">{error}</p>
          ) : (
            <>
              {migrationRequired ? (
                <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Run <code className="text-xs">scripts/171_department_staff_hour_logs.sql</code>{" "}
                  (after 169/170) in Supabase to enable hour logging and approvals. Custom date
                  ranges also need <code className="text-xs">172</code>.
                </p>
              ) : null}
              {rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No pay periods yet. Create a custom date range for all employees and childcare
                  providers (for example Aug 17–Aug 31), then log hours into that period.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Pay period</TableHead>
                        <TableHead className="text-right">Total payment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[280px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id || `${row.staffId}-${row.periodKey}`}>
                          <TableCell className="font-medium">
                            <button
                              type="button"
                              className="text-left text-primary hover:underline"
                              onClick={() => void openDetail(row)}
                            >
                              {row.fullName}
                            </button>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              {row.isChildcareProvider || row.positionName ? (
                                <Badge variant="outline" className="font-normal text-xs">
                                  {row.positionName || "Childcare provider"}
                                </Badge>
                              ) : null}
                              <span className="text-xs text-muted-foreground capitalize">
                                {row.payBasis === "monthly"
                                  ? "Monthly salary"
                                  : row.hourlyRate != null
                                    ? `${formatCurrency(row.hourlyRate)}/hr`
                                    : "Hourly"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {row.payBasis === "monthly"
                              ? "—"
                              : row.hoursWorked == null
                                ? "—"
                                : `${row.hoursWorked} hrs`}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatPeriodRange(row.periodStart, row.periodEnd)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatCurrency(row.amount)}
                          </TableCell>
                          <TableCell>{statusBadge(row.status)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap justify-end gap-1">
                              {(row.status === "draft" || row.status === "rejected") &&
                              row.id &&
                              (canApprove || row.staffId === selfStaffId) ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={isPending}
                                  onClick={() =>
                                    runAction(() =>
                                      submitPayPeriodAction({
                                        departmentId,
                                        payEntryId: row.id!,
                                      })
                                    )
                                  }
                                >
                                  <Send className="mr-1 size-3.5" />
                                  Submit
                                </Button>
                              ) : null}
                              {canApprove && row.status === "pending" && row.id ? (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={isPending}
                                    onClick={() =>
                                      runAction(() =>
                                        approvePayPeriodAction({
                                          departmentId,
                                          payEntryId: row.id!,
                                          approve: true,
                                        })
                                      )
                                    }
                                  >
                                    <Check className="mr-1 size-3.5" />
                                    Approve
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={isPending}
                                    onClick={() =>
                                      runAction(() =>
                                        approvePayPeriodAction({
                                          departmentId,
                                          payEntryId: row.id!,
                                          approve: false,
                                        })
                                      )
                                    }
                                  >
                                    <X className="mr-1 size-3.5" />
                                    Reject
                                  </Button>
                                </>
                              ) : null}
                              {canApprove && row.id ? (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={isPending}
                                    onClick={() => setEditRow(row)}
                                  >
                                    <Pencil className="mr-1 size-3.5" />
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="text-destructive hover:text-destructive"
                                    disabled={isPending}
                                    onClick={() => {
                                      const confirmed = window.confirm(
                                        `Delete pay entry for ${row.fullName} (${formatPeriodRange(row.periodStart, row.periodEnd)})?\n\nThis cannot be undone.`
                                      )
                                      if (!confirmed) return
                                      runAction(() =>
                                        deletePayPeriodEntryAction({
                                          departmentId,
                                          payEntryId: row.id!,
                                        })
                                      )
                                    }}
                                  >
                                    <Trash2 className="mr-1 size-3.5" />
                                    Delete
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <LogHoursDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        departmentId={departmentId}
        onSaved={async () => {
          setLogOpen(false)
          await load()
        }}
      />

      <CreatePayPeriodDialog
        open={salaryOpen}
        onOpenChange={setSalaryOpen}
        departmentId={departmentId}
        onSaved={async () => {
          setSalaryOpen(false)
          await load()
        }}
      />

      <EditPayPeriodDialog
        open={Boolean(editRow)}
        row={editRow}
        departmentId={departmentId}
        onOpenChange={(open) => {
          if (!open) setEditRow(null)
        }}
        onSaved={async () => {
          setEditRow(null)
          await load()
        }}
      />

      <Dialog
        open={Boolean(detailRow)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailRow(null)
            setDetailLogs([])
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailRow?.fullName}</DialogTitle>
            <DialogDescription>
              {detailRow
                ? formatPeriodRange(detailRow.periodStart, detailRow.periodEnd)
                : null}
            </DialogDescription>
          </DialogHeader>
          {detailRow ? (
            <div className="space-y-3 text-sm">
              <p>
                Total payment:{" "}
                <span className="font-medium tabular-nums">
                  {formatCurrency(detailRow.amount)}
                </span>
              </p>
              {detailRow.payBasis === "hourly" ? (
                detailLogs.length === 0 ? (
                  <p className="text-muted-foreground">No daily hour logs in this period.</p>
                ) : (
                  <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
                    {detailLogs.map((log) => (
                      <li key={log.id} className="flex justify-between gap-2 text-sm">
                        <span>
                          {formatDate(log.workDate)}
                          {log.eventName ? (
                            <span className="text-muted-foreground"> · {log.eventName}</span>
                          ) : log.notes ? (
                            <span className="text-muted-foreground"> · {log.notes}</span>
                          ) : null}
                        </span>
                        <span className="tabular-nums">{log.hours} hrs</span>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <p className="text-muted-foreground">Fixed monthly salary — no hours required.</p>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LogHoursDialog({
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
  const [targetDepartmentId, setTargetDepartmentId] = useState(departmentId)
  const [staffId, setStaffId] = useState("")
  const [staffOptions, setStaffOptions] = useState<PayrollStaffOption[]>([])
  const [departments, setDepartments] = useState<PayrollDepartmentOption[]>([])
  const [canManage, setCanManage] = useState(false)
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [hours, setHours] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setTargetDepartmentId(departmentId)
    let cancelled = false
    async function loadOptions() {
      const result = await listPayrollHourLogOptionsAction(departmentId)
      if (cancelled || !result.success) return
      setCanManage(result.canManage)
      setDepartments(result.departments)
      setStaffOptions(result.staffOptions)
      if (result.selfStaffId) {
        setStaffId(result.selfStaffId)
      } else if (result.staffOptions[0]) {
        setStaffId(result.staffOptions[0].staffId)
      }
    }
    void loadOptions()
    return () => {
      cancelled = true
    }
  }, [open, departmentId])

  const selectedStaff = staffOptions.find((option) => option.staffId === staffId)
  const showDepartmentPicker = Boolean(selectedStaff?.isChildcareProvider)

  useEffect(() => {
    if (!selectedStaff?.isChildcareProvider) {
      setTargetDepartmentId(departmentId)
    }
  }, [selectedStaff?.isChildcareProvider, departmentId])

  function handleSave() {
    const parsedHours = Number(hours)
    if (!staffId) {
      setError("Select an employee.")
      return
    }
    if (!targetDepartmentId) {
      setError("Select a department.")
      return
    }
    if (!workDate) {
      setError("Choose a date.")
      return
    }
    if (Number.isNaN(parsedHours) || parsedHours <= 0) {
      setError("Enter hours greater than 0.")
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await logDepartmentStaffHoursAction({
        departmentId: targetDepartmentId,
        staffId,
        workDate,
        hours: parsedHours,
        notes,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setHours("")
      setNotes("")
      await onSaved()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log hours</DialogTitle>
          <DialogDescription>
            Enter hours worked on a specific date. Childcare providers can assign hours to any
            department; payment uses the hourly rate on that department&apos;s pay period.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {showDepartmentPicker ? (
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={targetDepartmentId}
                onValueChange={setTargetDepartmentId}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {canManage ? (
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={staffId} onValueChange={setStaffId} disabled={isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {staffOptions.map((option) => (
                    <SelectItem key={option.staffId} value={option.staffId}>
                      {option.fullName}
                      {option.isChildcareProvider
                        ? ` · ${option.positionName || "Childcare"}`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Logging hours for your employee record
              {staffId ? "" : " (link your login to a staff contact first)"}.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="work-date">Date</Label>
            <Input
              id="work-date"
              type="date"
              value={workDate}
              onChange={(event) => setWorkDate(event.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hours">Hours</Label>
            <Input
              id="hours"
              type="number"
              min="0.25"
              max="24"
              step="0.25"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              disabled={isPending}
              placeholder="e.g. 4"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hour-notes">Notes (optional)</Label>
            <Textarea
              id="hour-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={isPending}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending || !staffId}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save hours"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreatePayPeriodDialog({
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
      const result = await createPayPeriodForAllEmployeesAction({
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
          <DialogTitle>Create pay period</DialogTitle>
          <DialogDescription>
            Set a custom date range (for example the academic year start Aug 17–Aug 31). This
            creates a draft pay line for <strong>every department employee and every childcare
            provider</strong>.
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
              <Label htmlFor="period-start">Start date</Label>
              <Input
                id="period-start"
                type="date"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period-end">End date</Label>
              <Input
                id="period-end"
                type="date"
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
                disabled={isPending}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Hourly staff: hours logged for this department in this range roll into these lines.
            Monthly salary staff: one line with their salary amount (no hours).
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? "Creating..." : "Create for all"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditPayPeriodDialog({
  open,
  row,
  departmentId,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  row: DepartmentPayPeriodRow | null
  departmentId: string
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void>
}) {
  const [hours, setHours] = useState("")
  const [amount, setAmount] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!row || !open) return
    setHours(row.hoursWorked == null ? "" : String(row.hoursWorked))
    setAmount(String(row.amount ?? ""))
    setError(null)
  }, [row, open])

  function handleHoursChange(value: string) {
    setHours(value)
    if (!row || row.payBasis !== "hourly" || row.hourlyRate == null) return
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || value.trim() === "") return
    setAmount(String(Math.round(parsed * row.hourlyRate * 100) / 100))
  }

  function handleSave() {
    if (!row?.id) return
    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setError("Enter a valid payment amount.")
      return
    }

    let hoursWorked: number | null = null
    if (row.payBasis === "hourly") {
      if (hours.trim() === "") {
        hoursWorked = null
      } else {
        const parsedHours = Number(hours)
        if (!Number.isFinite(parsedHours) || parsedHours < 0) {
          setError("Enter valid hours.")
          return
        }
        hoursWorked = parsedHours
      }
    }

    setError(null)
    startTransition(async () => {
      const result = await updatePayPeriodEntryAction({
        departmentId,
        payEntryId: row.id!,
        hoursWorked: row.payBasis === "hourly" ? hoursWorked : null,
        amount: parsedAmount,
      })
      if (!result.success) {
        setError(result.error || "Could not save.")
        return
      }
      await onSaved()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit pay entry</DialogTitle>
          <DialogDescription>
            {row
              ? `${row.fullName} · ${formatPeriodRange(row.periodStart, row.periodEnd)}`
              : null}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {row?.payBasis === "hourly" ? (
            <div className="space-y-2">
              <Label htmlFor="edit-hours">Hours</Label>
              <Input
                id="edit-hours"
                type="number"
                min={0}
                step="0.01"
                value={hours}
                onChange={(event) => handleHoursChange(event.target.value)}
                disabled={isPending}
              />
              {row.hourlyRate != null ? (
                <p className="text-xs text-muted-foreground">
                  Rate {formatCurrency(row.hourlyRate)}/hr — amount updates when hours change.
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="edit-amount">Total payment</Label>
            <Input
              id="edit-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={isPending}
            />
          </div>
          {row ? (
            <p className="text-xs text-muted-foreground">
              Status stays {row.status}. Editing does not change approval status.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending || !row?.id}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

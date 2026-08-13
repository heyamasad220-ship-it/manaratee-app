"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import {
  Check,
  Clock,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react"

import { DepartmentEmployeeProfileSheet } from "@/components/departments/department-employee-profile-sheet"
import { HrContactPicker } from "@/components/hr/hr-contact-picker"
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
import type { DepartmentStaffMember } from "@/lib/departments/department-actions"
import {
  addEmployeeToDepartmentAction,
  listHrPositionsForDepartmentFormAction,
} from "@/lib/departments/department-staff-actions"
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

function formatPayRate(input: {
  payBasis: "hourly" | "monthly"
  hourlyRate: number | null
  monthlySalary: number | null
}) {
  if (input.payBasis === "monthly") {
    return input.monthlySalary == null
      ? "Monthly"
      : `${formatCurrency(input.monthlySalary)}/mo`
  }
  return input.hourlyRate == null
    ? "Hourly"
    : `${formatCurrency(input.hourlyRate)}/hr`
}

const STAFF_TYPE_OPTIONS = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "temporary", label: "Temporary" },
  { value: "contract", label: "Contract" },
  { value: "seasonal", label: "Seasonal" },
] as const

type MergedRow =
  | { kind: "pay"; pay: DepartmentPayPeriodRow; member: DepartmentStaffMember | null }
  | { kind: "staff"; member: DepartmentStaffMember }

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
  staff,
  onStaffChanged,
  openYearsOnly = true,
  programId = null,
  readOnly = false,
  stickyStatsTop,
  variant = "combined",
}: {
  departmentId: string
  departmentName: string
  staff: DepartmentStaffMember[]
  onStaffChanged: () => Promise<void> | void
  openYearsOnly?: boolean
  programId?: string | null
  readOnly?: boolean
  /** CSS `top` so KPI cards stick below department workspace tab chrome. */
  stickyStatsTop?: string
  /**
   * `roster` — Employees tab (staff only).
   * `periods` — Payroll tab (pay periods, log hours, create periods).
   * `combined` — legacy / reports mixed view.
   */
  variant?: "roster" | "periods" | "combined"
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
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false)
  const [profileStaffId, setProfileStaffId] = useState<string | null>(null)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [selectedContactLabel, setSelectedContactLabel] = useState("")
  const [staffType, setStaffType] = useState<string>("full_time")
  const [employmentStatus, setEmploymentStatus] = useState<string>("active")
  const [positionId, setPositionId] = useState<string>("")
  const [employeePayBasis, setEmployeePayBasis] = useState<"hourly" | "monthly">("hourly")
  const [hourlyRate, setHourlyRate] = useState("")
  const [monthlySalary, setMonthlySalary] = useState("")
  const [positions, setPositions] = useState<Array<{ id: string; name: string }>>([])
  const [positionsLoading, setPositionsLoading] = useState(false)
  const [employeeError, setEmployeeError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentPayrollListAction(departmentId, {
      openYearsOnly,
      programId,
    })
    if (!result.success) {
      setError(result.error)
      setRows([])
      setLoading(false)
      return
    }
    setRows(result.rows)
    setCanApprove(readOnly ? false : result.canApprove)
    setSelfStaffId(result.selfStaffId)
    setMigrationRequired(result.migrationRequired)
    setLoading(false)
  }, [departmentId, openYearsOnly, programId, readOnly])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!employeeDialogOpen) return
    let cancelled = false
    async function loadPositions() {
      setPositionsLoading(true)
      const result = await listHrPositionsForDepartmentFormAction(departmentId)
      if (!cancelled) {
        if (result.success) setPositions(result.positions)
        else setPositions([])
        setPositionsLoading(false)
      }
    }
    void loadPositions()
    return () => {
      cancelled = true
    }
  }, [employeeDialogOpen, departmentId])

  const staffById = useMemo(() => {
    return new Map(staff.map((member) => [member.staffId, member]))
  }, [staff])

  const showRoster = variant === "roster" || variant === "combined"
  const showPeriods = variant === "periods" || variant === "combined"
  const isRosterOnly = variant === "roster"
  const isPeriodsOnly = variant === "periods"

  const mergedRows: MergedRow[] = useMemo(() => {
    const payRows: MergedRow[] = showPeriods
      ? rows.map((pay) => ({
          kind: "pay",
          pay,
          member: staffById.get(pay.staffId) ?? null,
        }))
      : []
    if (!showRoster) return payRows

    const staffIdsWithPay = new Set(rows.map((row) => row.staffId))
    const staffOnly: MergedRow[] = staff
      .filter((member) => (isRosterOnly ? true : !staffIdsWithPay.has(member.staffId)))
      .map((member) => ({ kind: "staff", member }))
    return [...payRows, ...staffOnly]
  }, [rows, staff, staffById, showPeriods, showRoster, isRosterOnly])

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

  function resetEmployeeForm() {
    setSelectedContactId(null)
    setSelectedContactLabel("")
    setStaffType("full_time")
    setEmploymentStatus("active")
    setPositionId("")
    setEmployeePayBasis("hourly")
    setHourlyRate("")
    setMonthlySalary("")
    setEmployeeError(null)
  }

  function openAddEmployee() {
    resetEmployeeForm()
    setEmployeeDialogOpen(true)
  }

  function openEmployeeProfile(staffId: string) {
    setProfileStaffId(staffId)
  }

  function parseMoneyInput(value: string, label: string): number | null | undefined {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    if (Number.isNaN(parsed) || parsed < 0) {
      setEmployeeError(`Enter a valid ${label} (0 or greater), or leave it blank.`)
      return undefined
    }
    return parsed
  }

  function handleSaveEmployee() {
    const parsedRate = parseMoneyInput(hourlyRate, "hourly rate")
    if (parsedRate === undefined) return
    const parsedSalary = parseMoneyInput(monthlySalary, "monthly salary")
    if (parsedSalary === undefined) return

    const selectedPosition = positions.find((item) => item.id === positionId)

    if (!selectedContactId) {
      setEmployeeError("Select a contact first. Create them in Contacts if they are not listed.")
      return
    }

    setEmployeeError(null)
    startTransition(async () => {
      const result = await addEmployeeToDepartmentAction({
        departmentId,
        contactId: selectedContactId,
        staff_type: staffType as
          | "full_time"
          | "part_time"
          | "temporary"
          | "contract"
          | "seasonal",
        status: employmentStatus as "active" | "inactive" | "on_leave" | "pending",
        position_id: positionId || null,
        position_name: selectedPosition?.name || null,
        pay_basis: employeePayBasis,
        hourly_rate: parsedRate,
        monthly_salary: parsedSalary,
      })

      if (!result.success) {
        setEmployeeError(result.error)
        return
      }

      setEmployeeDialogOpen(false)
      resetEmployeeForm()
      await onStaffChanged()
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
      {!loading && !error && !isPeriodsOnly ? (
        <div
          className={
            stickyStatsTop
              ? "sticky z-30 bg-background/95 py-1 backdrop-blur supports-[backdrop-filter]:bg-background/90"
              : undefined
          }
          style={stickyStatsTop ? { top: stickyStatsTop } : undefined}
        >
          {isRosterOnly ? (
            <StatCardsRow equal columns={2}>
              <StatCard
                layout="header"
                fill
                tone="blue"
                label="Employees"
                value={staff.length}
                icon={Users}
                hint="Assigned to department"
              />
              <StatCard
                layout="header"
                fill
                tone="emerald"
                label="Active"
                value={staff.filter((m) => m.employmentStatus === "active").length}
                icon={Check}
                hint="Employment status active"
              />
            </StatCardsRow>
          ) : (
            <StatCardsRow equal columns={6}>
              <StatCard
                layout="header"
                fill
                tone="blue"
                label="Employees"
                value={staff.length}
                icon={Users}
                hint="Assigned to department"
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
                icon={Wallet}
                hint="Provider lines"
              />
            </StatCardsRow>
          )}
        </div>
      ) : null}

      {isPeriodsOnly ? (
        <>
          {!readOnly ? (
            <div className="flex flex-wrap justify-end gap-2">
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
          ) : null}
          {migrationRequired ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Run <code className="text-xs">scripts/171_department_staff_hour_logs.sql</code>{" "}
              (after 169/170) in Supabase to enable hour logging and approvals. Custom date
              ranges also need <code className="text-xs">172</code>.
            </p>
          ) : null}
        </>
      ) : (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" />
              Employees
            </CardTitle>
            <CardDescription>
              {readOnly
                ? `Historical employees for ${departmentName}. Switch program above to compare.`
                : isRosterOnly
                  ? `Employees assigned to ${departmentName}. Manage hours and pay periods under Financial → Payroll.`
                  : `Employees assigned to ${departmentName}. Log hours and create pay periods here; approved pay shows under Financial → Payroll.`}
            </CardDescription>
          </div>
          {!readOnly ? (
          <div className="flex flex-wrap gap-2">
            {showRoster && canApprove ? (
              <Button type="button" size="sm" variant="outline" onClick={openAddEmployee}>
                <Plus className="mr-1.5 size-4" />
                Add employee
              </Button>
            ) : null}
            {showPeriods ? (
              <Button type="button" size="sm" onClick={() => setLogOpen(true)}>
                <Plus className="mr-1.5 size-4" />
                Log hours
              </Button>
            ) : null}
            {showPeriods && canApprove ? (
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
          ) : null}
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading employees...
            </p>
          ) : error ? (
            <p className="py-4 text-sm text-destructive">{error}</p>
          ) : (
            <>
              {showPeriods && migrationRequired ? (
                <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Run <code className="text-xs">scripts/171_department_staff_hour_logs.sql</code>{" "}
                  (after 169/170) in Supabase to enable hour logging and approvals. Custom date
                  ranges also need <code className="text-xs">172</code>.
                </p>
              ) : null}
              {mergedRows.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {isRosterOnly
                    ? "No employees assigned yet. Add an employee to get started."
                    : "No employees or pay periods yet. Add an employee, then create a pay period and log hours."}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Pay</TableHead>
                        {showPeriods ? (
                          <>
                            <TableHead>Hours</TableHead>
                            <TableHead>Pay period</TableHead>
                            <TableHead className="text-right">Total payment</TableHead>
                          </>
                        ) : null}
                        <TableHead>Status</TableHead>
                        {showPeriods ? <TableHead className="w-[280px]" /> : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mergedRows.map((item) => {
                        if (item.kind === "staff") {
                          const member = item.member
                          return (
                            <TableRow
                              key={`staff-${member.staffId}`}
                              className="cursor-pointer"
                              onClick={() => openEmployeeProfile(member.staffId)}
                            >
                              <TableCell className="font-medium text-primary">
                                {member.fullName}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {member.positionName || "—"}
                              </TableCell>
                              <TableCell className="tabular-nums text-muted-foreground">
                                {formatPayRate(member)}
                              </TableCell>
                              {showPeriods ? (
                                <>
                                  <TableCell className="text-muted-foreground">—</TableCell>
                                  <TableCell className="text-muted-foreground">—</TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    —
                                  </TableCell>
                                </>
                              ) : null}
                              <TableCell className="capitalize text-muted-foreground">
                                {member.employmentStatus || "—"}
                              </TableCell>
                              {showPeriods ? <TableCell /> : null}
                            </TableRow>
                          )
                        }

                        const row = item.pay
                        const member = item.member
                        const positionLabel =
                          row.positionName ||
                          (row.isChildcareProvider ? "Childcare provider" : null)

                        return (
                          <TableRow key={row.id || `${row.staffId}-${row.periodKey}`}>
                            <TableCell className="font-medium">
                              <button
                                type="button"
                                className="text-left text-primary hover:underline"
                                onClick={() => void openDetail(row)}
                              >
                                {row.fullName}
                              </button>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {positionLabel || "—"}
                            </TableCell>
                            <TableCell className="tabular-nums text-muted-foreground">
                              {formatPayRate(row)}
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
                                      Edit pay
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
                                {!isPeriodsOnly && canApprove && member ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={isPending}
                                    title="Open employee profile"
                                    onClick={() => openEmployeeProfile(member.staffId)}
                                  >
                                    <Users className="size-3.5" />
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      )}

      {showRoster ? (
        <Dialog
          open={employeeDialogOpen}
          onOpenChange={(open) => {
            setEmployeeDialogOpen(open)
            if (!open) resetEmployeeForm()
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add employee</DialogTitle>
              <DialogDescription>
                Choose an existing contact. If they are already an employee, they are assigned to{" "}
                {departmentName}. Otherwise a new employee record is created for this department.
                Create the person in Contacts first if they are missing.
              </DialogDescription>
            </DialogHeader>

          <div className="space-y-4 py-2">
            {employeeError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {employeeError}
              </div>
            ) : null}

              <HrContactPicker
                selectedContactId={selectedContactId}
                selectedLabel={selectedContactLabel}
                onChange={(contact) => {
                  setSelectedContactId(contact.contactId)
                  const name = contact.full_name?.trim() || "Unnamed"
                  const detail = contact.email || contact.phone
                  setSelectedContactLabel(detail ? `${name} (${detail})` : name)
                }}
                onClear={() => {
                  setSelectedContactId(null)
                  setSelectedContactLabel("")
                }}
                disabled={isPending}
              />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Employment type</Label>
                <Select value={staffType} onValueChange={setStaffType} disabled={isPending}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={employmentStatus}
                  onValueChange={setEmploymentStatus}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On leave</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Position</Label>
                <Select
                  value={positionId || "none"}
                  onValueChange={(value) => setPositionId(value === "none" ? "" : value)}
                  disabled={isPending || positionsLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={positionsLoading ? "Loading..." : "Select position"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No position</SelectItem>
                    {positions.map((position) => (
                      <SelectItem key={position.id} value={position.id}>
                        {position.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pay basis</Label>
                <Select
                  value={employeePayBasis}
                  onValueChange={(value) =>
                    setEmployeePayBasis(value as "hourly" | "monthly")
                  }
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="monthly">Monthly salary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {employeePayBasis === "hourly" ? (
                <div className="space-y-2">
                  <Label htmlFor="dept-hourly-rate">Hourly rate</Label>
                  <Input
                    id="dept-hourly-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={hourlyRate}
                    onChange={(event) => setHourlyRate(event.target.value)}
                    disabled={isPending}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="dept-monthly-salary">Monthly salary</Label>
                  <Input
                    id="dept-monthly-salary"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={monthlySalary}
                    onChange={(event) => setMonthlySalary(event.target.value)}
                    disabled={isPending}
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEmployeeDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveEmployee} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Add to department"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      ) : null}

      <DepartmentEmployeeProfileSheet
        open={Boolean(profileStaffId)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setProfileStaffId(null)
        }}
        departmentId={departmentId}
        departmentName={departmentName}
        staffId={profileStaffId}
        readOnly={readOnly}
        onChanged={async () => {
          await onStaffChanged()
          await load()
        }}
      />

      {showPeriods ? (
        <>
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
        </>
      ) : null}
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

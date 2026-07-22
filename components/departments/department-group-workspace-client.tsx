"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  DollarSign,
  FileBarChart,
  Heart,
  LayoutDashboard,
  Loader2,
  Pencil,
  PieChart,
  Plus,
  UserMinus,
  UserRound,
  Users,
  Wallet,
} from "lucide-react"

import { DepartmentApplicationsPanel } from "@/components/departments/department-applications-panel"
import { DepartmentBudgetPanel } from "@/components/departments/department-budget-panel"
import { DepartmentExpensesPanel } from "@/components/departments/department-expenses-panel"
import { DepartmentGroupGivingPanel } from "@/components/departments/department-group-giving-panel"
import { DepartmentOfferingsPanel } from "@/components/departments/department-offerings-panel"
import { DepartmentOverviewPanel } from "@/components/departments/department-overview-panel"
import { DepartmentParticipantsPanel } from "@/components/departments/department-participants-panel"
import { DepartmentPayrollPanel } from "@/components/departments/department-payroll-panel"
import { DepartmentReportsPanel } from "@/components/departments/department-reports-panel"
import { DepartmentSchedulePanel } from "@/components/departments/department-schedule-panel"
import { DonationGroupActivityPanel } from "@/components/donations/donation-group-activity-panel"
import { DonationGroupEditForm } from "@/components/donations/donation-group-edit-form"
import { HrContactPicker } from "@/components/hr/hr-contact-picker"
import { Header } from "@/components/layout/header"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { mapStatus, STATUS_COLORS } from "@/lib/contacts/contact-constants"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import {
  fetchDepartmentDetail,
  type DepartmentDetail,
  type DepartmentStaffMember,
} from "@/lib/departments/department-actions"
import {
  ensureDepartmentGivingLinkAction,
  findGivingGroupForDepartmentAction,
  type DepartmentGivingPair,
} from "@/lib/departments/department-giving-link"
import {
  addEmployeeToDepartmentAction,
  listHrPositionsForDepartmentFormAction,
  removeStaffFromDepartmentAction,
  updateDepartmentEmployeeAction,
} from "@/lib/departments/department-staff-actions"
import { WORKFORCE_DEPARTMENTS_PATH } from "@/lib/departments/department-paths"
import {
  departmentGroupWorkspaceHref,
  donationGroupGivingListHref,
  parseDepartmentWorkspaceTab,
  type GroupWorkspaceTab,
} from "@/lib/donations/donation-group-path"
import { DONATIONS_GROUP_GIVING_REPORT_PATH } from "@/lib/donations/donor-giving-report"
import {
  isSafeReturnToPath,
  RETURN_TO_QUERY_PARAM,
} from "@/lib/navigation/return-to"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type DepartmentGroupWorkspaceClientProps = {
  departmentId: string
  /** When opened from Group Giving, prefer this back link context. */
  entryPoint?: "hr" | "donations"
}

type GroupEditRecord = {
  id: string
  full_name: string | null
  primary_contact_name: string | null
  status: string | null
  notes: string | null
  giving_group_kind?: string | null
  linked_hr_team_id?: string | null
  linked_department_id?: string | null
}

const STAFF_TYPE_OPTIONS = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "temporary", label: "Temporary" },
  { value: "contract", label: "Contract" },
  { value: "seasonal", label: "Seasonal" },
] as const

function formatHourlyRate(value: number | null) {
  if (value == null) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function EmployeesPanel({
  department,
  onChanged,
}: {
  department: DepartmentDetail
  onChanged: () => Promise<void> | void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<DepartmentStaffMember | null>(null)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [selectedContactLabel, setSelectedContactLabel] = useState("")
  const [staffType, setStaffType] = useState<string>("full_time")
  const [status, setStatus] = useState<string>("active")
  const [positionId, setPositionId] = useState<string>("")
  const [payBasis, setPayBasis] = useState<"hourly" | "monthly">("hourly")
  const [hourlyRate, setHourlyRate] = useState("")
  const [monthlySalary, setMonthlySalary] = useState("")
  const [positions, setPositions] = useState<Array<{ id: string; name: string }>>([])
  const [positionsLoading, setPositionsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isEditing = Boolean(editingMember)

  useEffect(() => {
    if (!dialogOpen) return
    let cancelled = false
    async function loadPositions() {
      setPositionsLoading(true)
      const result = await listHrPositionsForDepartmentFormAction()
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
  }, [dialogOpen])

  function resetForm() {
    setEditingMember(null)
    setSelectedContactId(null)
    setSelectedContactLabel("")
    setStaffType("full_time")
    setStatus("active")
    setPositionId("")
    setPayBasis("hourly")
    setHourlyRate("")
    setMonthlySalary("")
    setError(null)
  }

  function openAddDialog() {
    resetForm()
    setDialogOpen(true)
  }

  function openEditDialog(member: DepartmentStaffMember) {
    setEditingMember(member)
    setSelectedContactId(member.contactId)
    setSelectedContactLabel(member.fullName)
    setStaffType(member.staffType || "full_time")
    setStatus(member.employmentStatus || "active")
    setPositionId(member.positionId || "")
    setPayBasis(member.payBasis || "hourly")
    setHourlyRate(member.hourlyRate == null ? "" : String(member.hourlyRate))
    setMonthlySalary(member.monthlySalary == null ? "" : String(member.monthlySalary))
    setError(null)
    setDialogOpen(true)
  }

  function parseMoneyInput(
    value: string,
    label: string
  ): number | null | undefined {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    if (Number.isNaN(parsed) || parsed < 0) {
      setError(`Enter a valid ${label} (0 or greater), or leave it blank.`)
      return undefined
    }
    return parsed
  }

  function handleSave() {
    const parsedRate = parseMoneyInput(hourlyRate, "hourly rate")
    if (parsedRate === undefined) return
    const parsedSalary = parseMoneyInput(monthlySalary, "monthly salary")
    if (parsedSalary === undefined) return

    const selectedPosition = positions.find((item) => item.id === positionId)

    if (isEditing && editingMember) {
      setError(null)
      startTransition(async () => {
        const result = await updateDepartmentEmployeeAction({
          departmentId: department.id,
          staffId: editingMember.staffId,
          staff_type: staffType as
            | "full_time"
            | "part_time"
            | "temporary"
            | "contract"
            | "seasonal",
          status: status as "active" | "inactive" | "on_leave" | "pending",
          position_id: positionId || null,
          position_name: selectedPosition?.name || null,
          pay_basis: payBasis,
          hourly_rate: parsedRate,
          monthly_salary: parsedSalary,
        })

        if (!result.success) {
          setError(result.error)
          return
        }

        setDialogOpen(false)
        resetForm()
        await onChanged()
      })
      return
    }

    if (!selectedContactId) {
      setError("Select a contact first. Create them in Contacts if they are not listed.")
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await addEmployeeToDepartmentAction({
        departmentId: department.id,
        contactId: selectedContactId,
        staff_type: staffType as
          | "full_time"
          | "part_time"
          | "temporary"
          | "contract"
          | "seasonal",
        status: status as "active" | "inactive" | "on_leave" | "pending",
        position_id: positionId || null,
        position_name: selectedPosition?.name || null,
        pay_basis: payBasis,
        hourly_rate: parsedRate,
        monthly_salary: parsedSalary,
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      setDialogOpen(false)
      resetForm()
      await onChanged()
    })
  }

  function handleRemove(member: DepartmentStaffMember) {
    if (
      !window.confirm(
        `Remove ${member.fullName} from this department? They remain an employee in HR.`
      )
    ) {
      return
    }

    startTransition(async () => {
      const result = await removeStaffFromDepartmentAction({
        departmentId: department.id,
        staffId: member.staffId,
      })
      if (!result.success) {
        alert(result.error)
        return
      }
      await onChanged()
    })
  }

  const staff = department.staff
  const activeCount = staff.filter(
    (member) => (member.employmentStatus || "active") === "active"
  ).length
  const hourlyCount = staff.filter((member) => member.payBasis === "hourly").length
  const monthlyCount = staff.filter((member) => member.payBasis === "monthly").length
  const positionCount = new Set(
    staff.map((member) => member.positionId).filter(Boolean)
  ).size

  return (
    <div className="space-y-6">
      <StatCardsRow equal columns={5}>
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
          value={activeCount}
          icon={UserRound}
          hint="Employment status"
        />
        <StatCard
          layout="header"
          fill
          tone="sky"
          label="Hourly"
          value={hourlyCount}
          icon={Wallet}
          hint="Pay basis"
        />
        <StatCard
          layout="header"
          fill
          tone="amber"
          label="Monthly"
          value={monthlyCount}
          icon={Briefcase}
          hint="Pay basis"
        />
        <StatCard
          layout="header"
          fill
          tone="violet"
          label="Positions"
          value={positionCount}
          icon={Briefcase}
          hint="Distinct roles filled"
        />
      </StatCardsRow>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Employees</CardTitle>
            <CardDescription>
              Staff assigned to this department. Click a name to open the contact page; use Edit
              for employment details.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add employee
          </Button>
        </CardHeader>
        <CardContent>
          {department.staff.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No employees assigned to this department yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Pay</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {department.staff.map((member) => (
                    <TableRow key={member.staffId}>
                      <TableCell className="font-medium">
                        {member.contactId ? (
                          <Link
                            href={contactProfileHref(member.contactId)}
                            className="text-primary hover:underline"
                          >
                            {member.fullName}
                          </Link>
                        ) : (
                          member.fullName
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.positionName || "—"}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {member.payBasis === "monthly"
                          ? member.monthlySalary == null
                            ? "Monthly"
                            : `${formatHourlyRate(member.monthlySalary)}/mo`
                          : member.hourlyRate == null
                            ? "Hourly"
                            : `${formatHourlyRate(member.hourlyRate)}/hr`}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.email || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.phone || "—"}
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">
                        {member.employmentStatus || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            title="Edit employment details"
                            disabled={isPending}
                            onClick={() => openEditDialog(member)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-amber-700"
                            title="Remove from department"
                            disabled={isPending}
                            onClick={() => handleRemove(member)}
                          >
                            <UserMinus className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit employee" : "Add employee"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? `Update employment details for ${editingMember?.fullName || "this employee"} in ${department.name}. Contact name and email are edited on the contact page.`
                : `Choose an existing contact. If they are already an employee, they are assigned to ${department.name}. Otherwise a new employee record is created for this department. Create the person in Contacts first if they are missing.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {isEditing ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <p className="font-medium">{editingMember?.fullName}</p>
                {editingMember?.contactId ? (
                  <Link
                    href={contactProfileHref(editingMember.contactId)}
                    className="text-xs text-primary hover:underline"
                  >
                    Open contact page
                  </Link>
                ) : null}
              </div>
            ) : (
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
            )}

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
                <Select value={status} onValueChange={setStatus} disabled={isPending}>
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
                  value={payBasis}
                  onValueChange={(value) => setPayBasis(value as "hourly" | "monthly")}
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
              {payBasis === "hourly" ? (
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
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                "Save changes"
              ) : (
                "Add to department"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function DepartmentGroupWorkspaceClient({
  departmentId,
  entryPoint = "hr",
}: DepartmentGroupWorkspaceClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [department, setDepartment] = useState<DepartmentDetail | null>(null)
  const [pair, setPair] = useState<DepartmentGivingPair | null>(null)
  const [groupEdit, setGroupEdit] = useState<GroupEditRecord | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  const returnTo = searchParams.get(RETURN_TO_QUERY_PARAM)
  const activeTab = parseDepartmentWorkspaceTab(searchParams.get("tab"))

  const backHref =
    entryPoint === "donations"
      ? donationGroupGivingListHref(
          returnTo && isSafeReturnToPath(returnTo)
            ? returnTo
            : DONATIONS_GROUP_GIVING_REPORT_PATH
        )
      : returnTo && isSafeReturnToPath(returnTo)
        ? returnTo
        : WORKFORCE_DEPARTMENTS_PATH

  const backLabel = entryPoint === "donations" ? "Group Giving" : "Departments"

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [departmentData, pairResult] = await Promise.all([
        fetchDepartmentDetail(departmentId),
        findGivingGroupForDepartmentAction(departmentId),
      ])

      if (!departmentData) {
        setDepartment(null)
        setPair(null)
        setError("This department could not be found.")
        setLoading(false)
        return
      }

      setDepartment(departmentData)

      let nextPair = pairResult.success ? pairResult.pair : null

      if (nextPair?.linkSource === "name_match") {
        const ensured = await ensureDepartmentGivingLinkAction({
          departmentId: nextPair.departmentId,
          groupContactId: nextPair.groupContactId,
        })
        if (ensured.success) {
          nextPair = { ...nextPair, linkSource: "linked" }
        }
      }

      setPair(nextPair)

      if (nextPair) {
        const { data: groupRow } = await supabase
          .from("contacts")
          .select(
            "id, full_name, primary_contact_name, status, notes, giving_group_kind, linked_hr_team_id, linked_department_id"
          )
          .eq("id", nextPair.groupContactId)
          .maybeSingle()

        if (groupRow) {
          setGroupEdit({
            ...(groupRow as GroupEditRecord),
            giving_group_kind: "department",
            linked_department_id: departmentId,
          })
        } else {
          setGroupEdit(null)
        }
      } else {
        setGroupEdit(null)
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load workspace."
      )
      setDepartment(null)
      setPair(null)
    } finally {
      setLoading(false)
    }
  }, [departmentId, supabase])

  useEffect(() => {
    void load()
  }, [load])

  function handleTabChange(tab: string) {
    const next = parseDepartmentWorkspaceTab(tab)
    // Don't show giving tabs when there is no paired group
    const safeTab = !pair && next === "group-giving" ? "overview" : next

    router.replace(
      departmentGroupWorkspaceHref(departmentId, {
        tab: safeTab,
        returnTo: returnTo && isSafeReturnToPath(returnTo) ? returnTo : undefined,
      }),
      { scroll: false }
    )
  }

  if (loading) {
    return (
      <>
        <Header title="Department" />
        <div className="flex items-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading workspace...
        </div>
      </>
    )
  }

  if (!department) {
    return (
      <>
        <Header title="Department Not Found" />
        <div className="space-y-4 p-6">
          <p className="text-sm text-muted-foreground">
            {error || "This department could not be found."}
          </p>
          <Button variant="outline" asChild>
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {backLabel}
            </Link>
          </Button>
        </div>
      </>
    )
  }

  const displayName = department.name
  const mappedStatus = pair?.groupStatus ? mapStatus(pair.groupStatus) : null
  const hasGiving = Boolean(pair?.groupContactId)
  const resolvedTab: GroupWorkspaceTab =
    !hasGiving && activeTab === "group-giving" ? "overview" : activeTab

  return (
    <>
      <Header title={displayName} />
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <Button variant="ghost" size="sm" className="-ml-2 h-8 px-2" asChild>
              <Link href={backHref}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                {backLabel}
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-block size-3 rounded-full border"
                style={{ backgroundColor: department.color || "#3b82f6" }}
              />
              <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
              {mappedStatus ? (
                <Badge
                  variant="secondary"
                  className={cn("font-normal", STATUS_COLORS[mappedStatus])}
                >
                  {mappedStatus}
                </Badge>
              ) : null}
              <Badge variant="outline" className="font-normal">
                Department
              </Badge>
            </div>
          </div>
          {groupEdit ? (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit group
            </Button>
          ) : null}
        </div>

        <Tabs value={resolvedTab} onValueChange={handleTabChange}>
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="size-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="employees" className="gap-2">
              <UserRound className="size-4" />
              Employees
            </TabsTrigger>
            <TabsTrigger value="rosters" className="gap-2">
              <Users className="size-4" />
              Rosters
            </TabsTrigger>
            <TabsTrigger value="offerings" className="gap-2">
              <BookOpen className="size-4" />
              Offerings
            </TabsTrigger>
            <TabsTrigger value="applications" className="gap-2">
              <ClipboardCheck className="size-4" />
              Applications
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2">
              <CalendarClock className="size-4" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="payroll" className="gap-2">
              <Wallet className="size-4" />
              Payroll
            </TabsTrigger>
            <TabsTrigger value="expenses" className="gap-2">
              <DollarSign className="size-4" />
              Expenses
            </TabsTrigger>
            <TabsTrigger value="budget" className="gap-2">
              <PieChart className="size-4" />
              Financial Summary
            </TabsTrigger>
            {hasGiving ? (
              <TabsTrigger value="group-giving" className="gap-2">
                <Heart className="size-4" />
                Group giving
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="activity" className="gap-2">
              <CalendarDays className="size-4" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <FileBarChart className="size-4" />
              Reports
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {resolvedTab === "overview" ? (
          <DepartmentOverviewPanel
            departmentId={department.id}
            departmentName={displayName}
          />
        ) : null}

        {resolvedTab === "employees" ? (
          <EmployeesPanel department={department} onChanged={load} />
        ) : null}

        {resolvedTab === "rosters" ? (
          <DepartmentParticipantsPanel
            departmentId={department.id}
            departmentName={displayName}
          />
        ) : null}

        {resolvedTab === "offerings" ? (
          <DepartmentOfferingsPanel
            departmentId={department.id}
            departmentName={displayName}
          />
        ) : null}

        {resolvedTab === "applications" ? (
          <DepartmentApplicationsPanel
            departmentId={department.id}
            departmentName={displayName}
          />
        ) : null}

        {resolvedTab === "schedule" ? (
          <DepartmentSchedulePanel
            departmentId={department.id}
            departmentName={displayName}
          />
        ) : null}

        {resolvedTab === "payroll" ? (
          <DepartmentPayrollPanel
            departmentId={department.id}
            departmentName={displayName}
          />
        ) : null}

        {resolvedTab === "expenses" ? (
          <DepartmentExpensesPanel
            departmentId={department.id}
            departmentName={displayName}
          />
        ) : null}

        {resolvedTab === "budget" ? (
          <DepartmentBudgetPanel
            departmentId={department.id}
            departmentName={displayName}
          />
        ) : null}

        {resolvedTab === "group-giving" && pair ? (
          <DepartmentGroupGivingPanel
            groupContactId={pair.groupContactId}
            groupName={pair.groupName || displayName}
            refreshToken={refreshToken}
          />
        ) : null}

        {resolvedTab === "activity" ? (
          <DonationGroupActivityPanel
            departmentId={department.id}
            groupContactId={pair?.groupContactId}
            refreshToken={refreshToken}
          />
        ) : null}

        {resolvedTab === "reports" ? (
          <DepartmentReportsPanel
            departmentId={department.id}
            departmentName={displayName}
          />
        ) : null}
      </div>

      {groupEdit ? (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit group</DialogTitle>
            </DialogHeader>
            <DonationGroupEditForm
              group={groupEdit}
              onCancel={() => setEditOpen(false)}
              onSaved={async () => {
                setEditOpen(false)
                await load()
                setRefreshToken((current) => current + 1)
              }}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}

"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import {
  Briefcase,
  ExternalLink,
  Loader2,
  Mail,
  Phone,
  UserMinus,
  Wallet,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import {
  fetchDepartmentEmployeeProfileAction,
  listHrJobRolesForDepartmentFormAction,
  listHrPositionsForDepartmentFormAction,
  removeStaffFromDepartmentAction,
  updateDepartmentEmployeeAction,
  type DepartmentEmployeeProfile,
} from "@/lib/departments/department-staff-actions"

const STAFF_TYPE_OPTIONS = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "temporary", label: "Temporary" },
  { value: "contract", label: "Contract" },
  { value: "seasonal", label: "Seasonal" },
] as const

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "on_leave", label: "On leave" },
  { value: "pending", label: "Pending" },
] as const

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatPeriod(start: string, end: string) {
  return `${formatDate(start)} – ${formatDate(end)}`
}

export function DepartmentEmployeeProfileSheet({
  open,
  onOpenChange,
  departmentId,
  departmentName,
  staffId,
  readOnly = false,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  departmentId: string
  departmentName: string
  staffId: string | null
  readOnly?: boolean
  onChanged: () => Promise<void> | void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<DepartmentEmployeeProfile | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [positions, setPositions] = useState<Array<{ id: string; name: string }>>([])
  const [jobRoles, setJobRoles] = useState<Array<{ id: string; name: string }>>([])
  const [isPending, startTransition] = useTransition()

  const [staffType, setStaffType] = useState<string>("full_time")
  const [status, setStatus] = useState<string>("active")
  const [positionId, setPositionId] = useState("")
  const [jobRoleId, setJobRoleId] = useState("")
  const [hireDate, setHireDate] = useState("")
  const [payBasis, setPayBasis] = useState<"hourly" | "monthly">("hourly")
  const [hourlyRate, setHourlyRate] = useState("")
  const [monthlySalary, setMonthlySalary] = useState("")

  const editable = canEdit && !readOnly

  const applyProfile = useCallback((next: DepartmentEmployeeProfile) => {
    setProfile(next)
    setStaffType(next.staffType)
    setStatus(next.employmentStatus)
    setPositionId(next.positionId || "")
    setJobRoleId(next.hrJobRoleId || "")
    setHireDate(next.hireDate || "")
    setPayBasis(next.payBasis)
    setHourlyRate(next.hourlyRate == null ? "" : String(next.hourlyRate))
    setMonthlySalary(next.monthlySalary == null ? "" : String(next.monthlySalary))
  }, [])

  const load = useCallback(async () => {
    if (!staffId || !open) return
    setLoading(true)
    setError(null)
    const [profileResult, positionsResult, rolesResult] = await Promise.all([
      fetchDepartmentEmployeeProfileAction({ departmentId, staffId }),
      listHrPositionsForDepartmentFormAction(departmentId),
      listHrJobRolesForDepartmentFormAction(departmentId),
    ])

    if (!profileResult.success) {
      setProfile(null)
      setCanEdit(false)
      setError(profileResult.error)
      setLoading(false)
      return
    }

    applyProfile(profileResult.profile)
    setCanEdit(profileResult.canEdit)
    setPositions(positionsResult.success ? positionsResult.positions : [])
    setJobRoles(rolesResult.success ? rolesResult.roles : [])
    setLoading(false)
  }, [applyProfile, departmentId, open, staffId])

  useEffect(() => {
    void load()
  }, [load])

  function parseMoney(value: string, label: string): number | null | undefined {
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
    if (!staffId || !editable) return
    const parsedRate = parseMoney(hourlyRate, "hourly rate")
    if (parsedRate === undefined) return
    const parsedSalary = parseMoney(monthlySalary, "monthly salary")
    if (parsedSalary === undefined) return

    const selectedPosition = positions.find((item) => item.id === positionId)
    setError(null)
    startTransition(async () => {
      const result = await updateDepartmentEmployeeAction({
        departmentId,
        staffId,
        staff_type: staffType as DepartmentEmployeeProfile["staffType"],
        status: status as DepartmentEmployeeProfile["employmentStatus"],
        position_id: positionId || null,
        position_name: selectedPosition?.name || null,
        hr_job_role_id: jobRoleId || null,
        hire_date: hireDate || null,
        pay_basis: payBasis,
        hourly_rate: parsedRate,
        monthly_salary: parsedSalary,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      await onChanged()
      await load()
    })
  }

  function handleRemove() {
    if (!staffId || !profile?.canRemove) return
    if (
      !window.confirm(
        `Remove ${profile.fullName} from ${departmentName}? They remain an employee in HR.`
      )
    ) {
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await removeStaffFromDepartmentAction({
        departmentId,
        staffId,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      onOpenChange(false)
      await onChanged()
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <SheetHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
          <SheetTitle>
            {profile?.fullName || (loading ? "Loading…" : "Employee")}
          </SheetTitle>
          <SheetDescription>
            Employment details for {departmentName}. Opens in edit mode when you can manage
            this department.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading employee profile…
            </p>
          ) : error && !profile ? (
            <p className="py-6 text-sm text-destructive">{error}</p>
          ) : profile ? (
            <div className="space-y-6">
              {error ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="capitalize font-normal">
                  {profile.employmentStatus.replace("_", " ")}
                </Badge>
                <Badge variant="outline" className="font-normal">
                  {STAFF_TYPE_OPTIONS.find((o) => o.value === profile.staffType)?.label ||
                    profile.staffType}
                </Badge>
                {profile.isDepartmentHead ? (
                  <Badge variant="outline" className="font-normal">
                    Department head
                  </Badge>
                ) : null}
              </div>

              {profile.contactId ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={contactProfileHref(profile.contactId)}>
                    <ExternalLink className="mr-1.5 size-3.5" />
                    Open contact profile
                  </Link>
                </Button>
              ) : (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  This employee is not linked to a contact.
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Department</Label>
                  <Input value={profile.departmentName || departmentName} disabled />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emp-status">Employment status</Label>
                  {editable ? (
                    <Select value={status} onValueChange={setStatus} disabled={isPending}>
                      <SelectTrigger id="emp-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={status.replace("_", " ")} disabled className="capitalize" />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emp-type">Staff type</Label>
                  {editable ? (
                    <Select value={staffType} onValueChange={setStaffType} disabled={isPending}>
                      <SelectTrigger id="emp-type">
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
                  ) : (
                    <Input
                      value={
                        STAFF_TYPE_OPTIONS.find((o) => o.value === staffType)?.label || staffType
                      }
                      disabled
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emp-position">Position</Label>
                  {editable ? (
                    <Select
                      value={positionId || "__none__"}
                      onValueChange={(value) =>
                        setPositionId(value === "__none__" ? "" : value)
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger id="emp-position">
                        <SelectValue placeholder="Select position" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No position</SelectItem>
                        {positions.map((position) => (
                          <SelectItem key={position.id} value={position.id}>
                            {position.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={profile.positionName || "—"} disabled />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emp-role">Job role</Label>
                  {editable ? (
                    <Select
                      value={jobRoleId || "__none__"}
                      onValueChange={(value) =>
                        setJobRoleId(value === "__none__" ? "" : value)
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger id="emp-role">
                        <SelectValue placeholder="Select job role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No job role</SelectItem>
                        {jobRoles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={profile.hrJobRoleName || "—"} disabled />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emp-hire">Hire date</Label>
                  <Input
                    id="emp-hire"
                    type="date"
                    value={hireDate}
                    onChange={(event) => setHireDate(event.target.value)}
                    disabled={!editable || isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emp-pay-basis">Pay basis</Label>
                  {editable ? (
                    <Select
                      value={payBasis}
                      onValueChange={(value) =>
                        setPayBasis(value as "hourly" | "monthly")
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger id="emp-pay-basis">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="monthly">Monthly salary</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={payBasis === "monthly" ? "Monthly salary" : "Hourly"}
                      disabled
                    />
                  )}
                </div>

                {payBasis === "hourly" ? (
                  <div className="space-y-2">
                    <Label htmlFor="emp-hourly">Hourly rate</Label>
                    <Input
                      id="emp-hourly"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={hourlyRate}
                      onChange={(event) => setHourlyRate(event.target.value)}
                      disabled={!editable || isPending}
                      placeholder="0.00"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="emp-salary">Monthly salary</Label>
                    <Input
                      id="emp-salary"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={monthlySalary}
                      onChange={(event) => setMonthlySalary(event.target.value)}
                      disabled={!editable || isPending}
                      placeholder="0.00"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Mail className="size-3.5" />
                    Email
                  </Label>
                  <Input value={profile.email || "—"} disabled />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Phone className="size-3.5" />
                    Phone
                  </Label>
                  <Input value={profile.phone || "—"} disabled />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Email and phone are edited on the contact profile.
              </p>

              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <Wallet className="size-4" />
                  Recent pay periods
                </h3>
                {profile.recentPayEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pay periods yet.</p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {profile.recentPayEntries.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <div>
                          <p>{formatPeriod(entry.periodStart, entry.periodEnd)}</p>
                          <p className="text-xs capitalize text-muted-foreground">
                            {entry.status}
                            {entry.hoursWorked != null ? ` · ${entry.hoursWorked} hrs` : ""}
                          </p>
                        </div>
                        <span className="tabular-nums font-medium">
                          {formatCurrency(entry.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <Briefcase className="size-4" />
                  Recent hour logs
                </h3>
                {profile.recentHourLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hour logs yet.</p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {profile.recentHourLogs.map((log) => (
                      <li
                        key={log.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <div>
                          <p>{formatDate(log.workDate)}</p>
                          {log.notes ? (
                            <p className="text-xs text-muted-foreground">{log.notes}</p>
                          ) : null}
                        </div>
                        <span className="tabular-nums">{log.hours} hrs</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : null}
        </div>

        {profile ? (
          <SheetFooter className="shrink-0 flex-row flex-wrap justify-between gap-2 border-t border-border px-6 py-4 sm:space-x-0">
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={!editable || isPending || !profile.canRemove}
                onClick={handleRemove}
              >
                <UserMinus className="mr-1.5 size-3.5" />
                Remove from department
              </Button>
              {!profile.canRemove && profile.removeBlockedReason ? (
                <p className="max-w-xs text-xs text-muted-foreground">
                  {profile.removeBlockedReason}
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Close
              </Button>
              {editable ? (
                <Button type="button" onClick={handleSave} disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              ) : null}
            </div>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getSelectedOrganizationIdClient } from "@/lib/organizations/get-selected-organization-id-client"
import {
  deleteAttendanceRecord,
  deleteTimeOffRecord,
  saveAttendanceRecord,
  saveTimeOffRecord,
} from "@/lib/hr/hr-report-actions"
import {
  ATTENDANCE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  STAFF_TYPE_LABELS,
  type AttendanceFormState,
  type AttendanceRecord,
  type AttendanceStatus,
  type DateRangeKey,
  type LeaveType,
  type ReportStaffMember,
  type TimeOffFormState,
  type TimeOffRecord,
  type TimeOffStatus,
} from "@/lib/hr/hr-report-types"
import { PEOPLE_MANAGEMENT_MODULE_LABEL } from "@/lib/hr/hr-module-label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Download, Users, Calendar, Clock, Building2, Plus, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

const reportsTabs = ["Overview", "Headcount", "Attendance", "Time Off"] as const
type ReportsTab = (typeof reportsTabs)[number]

const STAFF_TYPE_COLUMNS = ["full_time", "part_time", "temporary", "contract", "seasonal"] as const

const emptyAttendanceForm: AttendanceFormState = {
  staff_id: "",
  record_date: new Date().toISOString().slice(0, 10),
  status: "present",
  notes: "",
}

const emptyTimeOffForm: TimeOffFormState = {
  staff_id: "",
  leave_type: "vacation",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: new Date().toISOString().slice(0, 10),
  days_count: "1",
  status: "approved",
  notes: "",
}

function getRangeStart(dateRange: DateRangeKey) {
  const start = new Date()
  if (dateRange === "7d") start.setDate(start.getDate() - 7)
  else if (dateRange === "30d") start.setDate(start.getDate() - 30)
  else if (dateRange === "90d") start.setDate(start.getDate() - 90)
  else start.setFullYear(start.getFullYear() - 1)
  return start.toISOString().slice(0, 10)
}

function formatDisplayDate(value: string | null) {
  if (!value) return "-"
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function isDateInRange(value: string, rangeStart: string) {
  return value.slice(0, 10) >= rangeStart
}

function timeOffOverlapsRange(record: TimeOffRecord, rangeStart: string) {
  return record.end_date.slice(0, 10) >= rangeStart
}

function staffFullName(staff: ReportStaffMember) {
  return `${staff.first_name} ${staff.last_name}`.trim()
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function HRReportsClient({ organizationId }: { organizationId: string | null }) {
  const supabase = createClient()

  const [resolvedOrganizationId, setResolvedOrganizationId] = useState<string | null>(organizationId)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<ReportsTab>("Overview")
  const [dateRange, setDateRange] = useState<DateRangeKey>("30d")

  const [staff, setStaff] = useState<ReportStaffMember[]>([])
  const [departmentCount, setDepartmentCount] = useState(0)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [timeOffRecords, setTimeOffRecords] = useState<TimeOffRecord[]>([])

  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false)
  const [timeOffDialogOpen, setTimeOffDialogOpen] = useState(false)
  const [editingAttendanceId, setEditingAttendanceId] = useState<string | null>(null)
  const [editingTimeOffId, setEditingTimeOffId] = useState<string | null>(null)
  const [attendanceForm, setAttendanceForm] = useState<AttendanceFormState>(emptyAttendanceForm)
  const [timeOffForm, setTimeOffForm] = useState<TimeOffFormState>(emptyTimeOffForm)

  const rangeStart = useMemo(() => getRangeStart(dateRange), [dateRange])

  useEffect(() => {
    async function resolveOrganizationId() {
      if (organizationId) {
        setResolvedOrganizationId(organizationId)
        return
      }
      setResolvedOrganizationId(await getSelectedOrganizationIdClient())
    }
    void resolveOrganizationId()
  }, [organizationId])

  const fetchReportData = useCallback(async () => {
    if (!resolvedOrganizationId) {
      setStaff([])
      setDepartmentCount(0)
      setAttendanceRecords([])
      setTimeOffRecords([])
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const [staffResult, departmentsResult, attendanceResult, timeOffResult] = await Promise.all([
        supabase
          .from("staff")
          .select("id, first_name, last_name, staff_type, status, hire_date, department_id, departments(name)")
          .eq("organization_id", resolvedOrganizationId)
          .order("last_name", { ascending: true }),
        supabase
          .from("departments")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", resolvedOrganizationId),
        supabase
          .from("hr_attendance_records")
          .select("id, staff_id, record_date, status, notes, staff:staff_id(first_name, last_name, department_id, departments(name))")
          .eq("organization_id", resolvedOrganizationId)
          .order("record_date", { ascending: false }),
        supabase
          .from("hr_time_off_records")
          .select("id, staff_id, leave_type, start_date, end_date, days_count, status, notes, staff:staff_id(first_name, last_name, department_id, departments(name))")
          .eq("organization_id", resolvedOrganizationId)
          .order("start_date", { ascending: false }),
      ])

      if (staffResult.error) throw staffResult.error
      if (departmentsResult.error) throw departmentsResult.error
      if (attendanceResult.error) throw attendanceResult.error
      if (timeOffResult.error) throw timeOffResult.error

      setStaff(
        (staffResult.data || []).map((row: any) => ({
          id: row.id,
          first_name: row.first_name,
          last_name: row.last_name,
          staff_type: row.staff_type || "full_time",
          status: row.status || "active",
          hire_date: row.hire_date,
          department_id: row.department_id,
          department_name: row.departments?.name || null,
        }))
      )
      setDepartmentCount(departmentsResult.count || 0)

      setAttendanceRecords(
        (attendanceResult.data || []).map((row: any) => ({
          id: row.id,
          staff_id: row.staff_id,
          staff_name: `${row.staff?.first_name || ""} ${row.staff?.last_name || ""}`.trim(),
          department_name: row.staff?.departments?.name || null,
          record_date: row.record_date,
          status: row.status,
          notes: row.notes,
        }))
      )

      setTimeOffRecords(
        (timeOffResult.data || []).map((row: any) => ({
          id: row.id,
          staff_id: row.staff_id,
          staff_name: `${row.staff?.first_name || ""} ${row.staff?.last_name || ""}`.trim(),
          department_name: row.staff?.departments?.name || null,
          leave_type: row.leave_type,
          start_date: row.start_date,
          end_date: row.end_date,
          days_count: Number(row.days_count) || 0,
          status: row.status,
          notes: row.notes,
        }))
      )
    } catch (error: any) {
      console.error("HR reports load error:", error)
      alert(error?.message || `Could not load ${PEOPLE_MANAGEMENT_MODULE_LABEL.toLowerCase()} reports.`)
    } finally {
      setLoading(false)
    }
  }, [resolvedOrganizationId, supabase])

  useEffect(() => {
    void fetchReportData()
  }, [fetchReportData])

  const filteredAttendance = useMemo(
    () => attendanceRecords.filter((record) => isDateInRange(record.record_date, rangeStart)),
    [attendanceRecords, rangeStart]
  )

  const filteredTimeOff = useMemo(
    () =>
      timeOffRecords.filter(
        (record) => timeOffOverlapsRange(record, rangeStart) && record.status === "approved"
      ),
    [timeOffRecords, rangeStart]
  )

  const activeStaff = useMemo(() => staff.filter((person) => person.status === "active"), [staff])

  const recentHires = useMemo(
    () =>
      staff
        .filter((person) => person.hire_date && isDateInRange(person.hire_date, rangeStart))
        .sort((a, b) => (b.hire_date || "").localeCompare(a.hire_date || "")),
    [staff, rangeStart]
  )

  const employeesByDepartment = useMemo(() => {
    const counts = new Map<string, number>()
    for (const person of activeStaff) {
      const label = person.department_name || "Unassigned"
      counts.set(label, (counts.get(label) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count)
  }, [activeStaff])

  const headcountRows = useMemo(() => {
    const rows = new Map<string, Record<string, number>>()

    for (const person of activeStaff) {
      const department = person.department_name || "Unassigned"
      if (!rows.has(department)) {
        rows.set(department, {
          full_time: 0,
          part_time: 0,
          temporary: 0,
          contract: 0,
          seasonal: 0,
          total: 0,
        })
      }
      const row = rows.get(department)!
      const type = person.staff_type in STAFF_TYPE_LABELS ? person.staff_type : "full_time"
      row[type] = (row[type] || 0) + 1
      row.total += 1
    }

    return Array.from(rows.entries())
      .map(([department, counts]) => ({ department, ...counts }))
      .sort((a, b) => a.department.localeCompare(b.department))
  }, [activeStaff])

  const headcountTotals = useMemo(() => {
    return headcountRows.reduce(
      (totals, row) => ({
        full_time: totals.full_time + row.full_time,
        part_time: totals.part_time + row.part_time,
        temporary: totals.temporary + row.temporary,
        contract: totals.contract + row.contract,
        seasonal: totals.seasonal + row.seasonal,
        total: totals.total + row.total,
      }),
      { full_time: 0, part_time: 0, temporary: 0, contract: 0, seasonal: 0, total: 0 }
    )
  }, [headcountRows])

  const attendanceByDepartment = useMemo(() => {
    const rows = new Map<
      string,
      { present: number; absent: number; late: number; excused: number; total: number }
    >()

    for (const record of filteredAttendance) {
      const department = record.department_name || "Unassigned"
      if (!rows.has(department)) {
        rows.set(department, { present: 0, absent: 0, late: 0, excused: 0, total: 0 })
      }
      const row = rows.get(department)!
      row[record.status] += 1
      row.total += 1
    }

    return Array.from(rows.entries())
      .map(([department, counts]) => {
        const counted = counts.present + counts.absent + counts.late
        const rate = counted > 0 ? (counts.present / counted) * 100 : 0
        return { department, ...counts, rate }
      })
      .sort((a, b) => a.department.localeCompare(b.department))
  }, [filteredAttendance])

  const timeOffByDepartment = useMemo(() => {
    const rows = new Map<
      string,
      { vacation: number; sick: number; personal: number; other: number; total: number }
    >()

    for (const record of filteredTimeOff) {
      const department = record.department_name || "Unassigned"
      if (!rows.has(department)) {
        rows.set(department, { vacation: 0, sick: 0, personal: 0, other: 0, total: 0 })
      }
      const row = rows.get(department)!
      row[record.leave_type] += record.days_count
      row.total += record.days_count
    }

    return Array.from(rows.entries())
      .map(([department, counts]) => ({ department, ...counts }))
      .sort((a, b) => a.department.localeCompare(b.department))
  }, [filteredTimeOff])

  const overviewStats = useMemo(() => {
    const countedAttendance = filteredAttendance.filter((record) => record.status !== "excused")
    const presentCount = countedAttendance.filter((record) => record.status === "present").length
    const attendanceRate =
      countedAttendance.length > 0 ? (presentCount / countedAttendance.length) * 100 : 0
    const totalTimeOffDays = filteredTimeOff.reduce((sum, record) => sum + record.days_count, 0)

    return {
      totalEmployees: activeStaff.length,
      newHires: recentHires.length,
      departments: departmentCount,
      avgPerDepartment:
        departmentCount > 0 ? Math.round((activeStaff.length / departmentCount) * 10) / 10 : 0,
      attendanceRate,
      totalTimeOffDays,
    }
  }, [activeStaff, recentHires, departmentCount, filteredAttendance, filteredTimeOff])

  function openAddAttendanceDialog() {
    setEditingAttendanceId(null)
    setAttendanceForm(emptyAttendanceForm)
    setAttendanceDialogOpen(true)
  }

  function openEditAttendanceDialog(record: AttendanceRecord) {
    setEditingAttendanceId(record.id)
    setAttendanceForm({
      staff_id: record.staff_id,
      record_date: record.record_date.slice(0, 10),
      status: record.status,
      notes: record.notes || "",
    })
    setAttendanceDialogOpen(true)
  }

  function openAddTimeOffDialog() {
    setEditingTimeOffId(null)
    setTimeOffForm(emptyTimeOffForm)
    setTimeOffDialogOpen(true)
  }

  function openEditTimeOffDialog(record: TimeOffRecord) {
    setEditingTimeOffId(record.id)
    setTimeOffForm({
      staff_id: record.staff_id,
      leave_type: record.leave_type,
      start_date: record.start_date.slice(0, 10),
      end_date: record.end_date.slice(0, 10),
      days_count: String(record.days_count),
      status: record.status,
      notes: record.notes || "",
    })
    setTimeOffDialogOpen(true)
  }

  async function handleSaveAttendance() {
    setSaving(true)
    try {
      await saveAttendanceRecord({
        ...attendanceForm,
        id: editingAttendanceId || undefined,
      })
      setAttendanceDialogOpen(false)
      await fetchReportData()
    } catch (error: any) {
      alert(error?.message || "Could not save attendance record.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAttendance(id: string) {
    if (!window.confirm("Delete this attendance record?")) return
    try {
      await deleteAttendanceRecord(id)
      await fetchReportData()
    } catch (error: any) {
      alert(error?.message || "Could not delete attendance record.")
    }
  }

  async function handleSaveTimeOff() {
    setSaving(true)
    try {
      await saveTimeOffRecord({
        ...timeOffForm,
        id: editingTimeOffId || undefined,
      })
      setTimeOffDialogOpen(false)
      await fetchReportData()
    } catch (error: any) {
      alert(error?.message || "Could not save time off record.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTimeOff(id: string) {
    if (!window.confirm("Delete this time off record?")) return
    try {
      await deleteTimeOffRecord(id)
      await fetchReportData()
    } catch (error: any) {
      alert(error?.message || "Could not delete time off record.")
    }
  }

  function handleExport() {
    if (activeTab === "Headcount") {
      downloadCsv("hr-headcount.csv", [
        ["Department", ...STAFF_TYPE_COLUMNS.map((type) => STAFF_TYPE_LABELS[type]), "Total"],
        ...headcountRows.map((row) => [
          row.department,
          ...STAFF_TYPE_COLUMNS.map((type) => String(row[type] || 0)),
          String(row.total),
        ]),
      ])
      return
    }

    if (activeTab === "Attendance") {
      downloadCsv("hr-attendance.csv", [
        ["Employee", "Department", "Date", "Status", "Notes"],
        ...filteredAttendance.map((record) => [
          record.staff_name,
          record.department_name || "Unassigned",
          formatDisplayDate(record.record_date),
          ATTENDANCE_STATUS_LABELS[record.status],
          record.notes || "",
        ]),
      ])
      return
    }

    if (activeTab === "Time Off") {
      downloadCsv("hr-time-off.csv", [
        ["Employee", "Department", "Type", "Start", "End", "Days", "Status", "Notes"],
        ...filteredTimeOff.map((record) => [
          record.staff_name,
          record.department_name || "Unassigned",
          LEAVE_TYPE_LABELS[record.leave_type],
          formatDisplayDate(record.start_date),
          formatDisplayDate(record.end_date),
          String(record.days_count),
          record.status,
          record.notes || "",
        ]),
      ])
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  return (
    <div className="p-6">
      {!resolvedOrganizationId && (
        <Card className="mb-6">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No organization ID was found. {PEOPLE_MANAGEMENT_MODULE_LABEL} reports cannot load until an organization is selected.
          </CardContent>
        </Card>
      )}

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-0 overflow-x-auto border-b border-border">
          {reportsTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRangeKey)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} disabled={activeTab === "Overview"}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {activeTab === "Overview" && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Employees
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overviewStats.totalEmployees}</div>
                <p className="text-xs text-muted-foreground">
                  {overviewStats.newHires} new hire{overviewStats.newHires === 1 ? "" : "s"} this period
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Departments</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overviewStats.departments}</div>
                <p className="text-xs text-muted-foreground">
                  {overviewStats.avgPerDepartment} avg employees/dept
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Attendance Rate
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredAttendance.length > 0 ? `${overviewStats.attendanceRate.toFixed(1)}%` : "—"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {filteredAttendance.length} attendance record
                  {filteredAttendance.length === 1 ? "" : "s"} in range
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Time Off Used</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overviewStats.totalTimeOffDays} days</div>
                <p className="text-xs text-muted-foreground">Approved leave in selected period</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Employees by Department</CardTitle>
                <CardDescription>Active employee headcount by department</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead>Employees</TableHead>
                      <TableHead className="text-right">% of Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeesByDepartment.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                          No active employees yet. Add employees under {PEOPLE_MANAGEMENT_MODULE_LABEL} → Employees.
                        </TableCell>
                      </TableRow>
                    ) : (
                      employeesByDepartment.map((row) => (
                        <TableRow key={row.department}>
                          <TableCell className="font-medium">{row.department}</TableCell>
                          <TableCell>{row.count}</TableCell>
                          <TableCell className="text-right">
                            {overviewStats.totalEmployees > 0
                              ? `${Math.round((row.count / overviewStats.totalEmployees) * 100)}%`
                              : "0%"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Hires</CardTitle>
                <CardDescription>New employees in the selected period</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Start Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentHires.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                          No hires in this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentHires.map((person) => (
                        <TableRow key={person.id}>
                          <TableCell className="font-medium">{staffFullName(person)}</TableCell>
                          <TableCell>{person.department_name || "Unassigned"}</TableCell>
                          <TableCell>{formatDisplayDate(person.hire_date)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "Headcount" && (
        <Card>
          <CardHeader>
            <CardTitle>Headcount Report</CardTitle>
            <CardDescription>
              Active employee count by department and employment type. Assign departments on the
              Employees page.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  {STAFF_TYPE_COLUMNS.map((type) => (
                    <TableHead key={type}>{STAFF_TYPE_LABELS[type]}</TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {headcountRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No active employees found.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {headcountRows.map((row) => (
                      <TableRow key={row.department}>
                        <TableCell className="font-medium">{row.department}</TableCell>
                        {STAFF_TYPE_COLUMNS.map((type) => (
                          <TableCell key={type}>{row[type] || 0}</TableCell>
                        ))}
                        <TableCell className="text-right font-medium">{row.total}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-semibold">Total</TableCell>
                      {STAFF_TYPE_COLUMNS.map((type) => (
                        <TableCell key={type} className="font-semibold">
                          {headcountTotals[type] || 0}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-semibold">{headcountTotals.total}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === "Attendance" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Attendance Records</h2>
              <p className="text-sm text-muted-foreground">
                Add daily attendance entries for your employees.
              </p>
            </div>
            <Button onClick={openAddAttendanceDialog} disabled={!resolvedOrganizationId || staff.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Add Attendance
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Attendance by Department</CardTitle>
              <CardDescription>Summary for the selected date range</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead>Total Records</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Absent</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead className="text-right">Attendance %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceByDepartment.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No attendance records in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    attendanceByDepartment.map((row) => (
                      <TableRow key={row.department}>
                        <TableCell className="font-medium">{row.department}</TableCell>
                        <TableCell>{row.total}</TableCell>
                        <TableCell>{row.present}</TableCell>
                        <TableCell>{row.absent}</TableCell>
                        <TableCell>{row.late}</TableCell>
                        <TableCell className="text-right">{row.rate.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttendance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No attendance records yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAttendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.staff_name}</TableCell>
                        <TableCell>{record.department_name || "Unassigned"}</TableCell>
                        <TableCell>{formatDisplayDate(record.record_date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{ATTENDANCE_STATUS_LABELS[record.status]}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-muted-foreground">
                          {record.notes || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => openEditAttendanceDialog(record)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-red-600"
                              onClick={() => handleDeleteAttendance(record.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "Time Off" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Time Off Records</h2>
              <p className="text-sm text-muted-foreground">
                Track approved and pending leave by employee.
              </p>
            </div>
            <Button onClick={openAddTimeOffDialog} disabled={!resolvedOrganizationId || staff.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Add Time Off
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Time Off by Department</CardTitle>
              <CardDescription>Approved leave days in the selected period</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead>Vacation</TableHead>
                    <TableHead>Sick Leave</TableHead>
                    <TableHead>Personal</TableHead>
                    <TableHead>Other</TableHead>
                    <TableHead className="text-right">Total Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeOffByDepartment.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No approved time off in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    timeOffByDepartment.map((row) => (
                      <TableRow key={row.department}>
                        <TableCell className="font-medium">{row.department}</TableCell>
                        <TableCell>{row.vacation}</TableCell>
                        <TableCell>{row.sick}</TableCell>
                        <TableCell>{row.personal}</TableCell>
                        <TableCell>{row.other}</TableCell>
                        <TableCell className="text-right font-medium">{row.total}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeOffRecords.filter((record) => timeOffOverlapsRange(record, rangeStart)).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        No time off records yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    timeOffRecords
                      .filter((record) => timeOffOverlapsRange(record, rangeStart))
                      .map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.staff_name}</TableCell>
                          <TableCell>{record.department_name || "Unassigned"}</TableCell>
                          <TableCell>{LEAVE_TYPE_LABELS[record.leave_type]}</TableCell>
                          <TableCell>{formatDisplayDate(record.start_date)}</TableCell>
                          <TableCell>{formatDisplayDate(record.end_date)}</TableCell>
                          <TableCell>{record.days_count}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{record.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="size-8" onClick={() => openEditTimeOffDialog(record)}>
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-red-600"
                                onClick={() => handleDeleteTimeOff(record.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAttendanceId ? "Edit Attendance" : "Add Attendance"}</DialogTitle>
            <DialogDescription>Record attendance for an employee on a specific date.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select
                value={attendanceForm.staff_id}
                onValueChange={(value) => setAttendanceForm({ ...attendanceForm, staff_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {staffFullName(person)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendance-date">Date</Label>
              <Input
                id="attendance-date"
                type="date"
                value={attendanceForm.record_date}
                onChange={(event) =>
                  setAttendanceForm({ ...attendanceForm, record_date: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={attendanceForm.status}
                onValueChange={(value) =>
                  setAttendanceForm({ ...attendanceForm, status: value as AttendanceStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendance-notes">Notes</Label>
              <Textarea
                id="attendance-notes"
                value={attendanceForm.notes}
                onChange={(event) =>
                  setAttendanceForm({ ...attendanceForm, notes: event.target.value })
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttendanceDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAttendance} disabled={saving || !attendanceForm.staff_id}>
              {saving ? "Saving..." : editingAttendanceId ? "Save Changes" : "Add Attendance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={timeOffDialogOpen} onOpenChange={setTimeOffDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTimeOffId ? "Edit Time Off" : "Add Time Off"}</DialogTitle>
            <DialogDescription>Record leave for an employee.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select
                value={timeOffForm.staff_id}
                onValueChange={(value) => setTimeOffForm({ ...timeOffForm, staff_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {staffFullName(person)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select
                value={timeOffForm.leave_type}
                onValueChange={(value) =>
                  setTimeOffForm({ ...timeOffForm, leave_type: value as LeaveType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="time-off-start">Start Date</Label>
                <Input
                  id="time-off-start"
                  type="date"
                  value={timeOffForm.start_date}
                  onChange={(event) =>
                    setTimeOffForm({ ...timeOffForm, start_date: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time-off-end">End Date</Label>
                <Input
                  id="time-off-end"
                  type="date"
                  value={timeOffForm.end_date}
                  onChange={(event) =>
                    setTimeOffForm({ ...timeOffForm, end_date: event.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="time-off-days">Days</Label>
                <Input
                  id="time-off-days"
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={timeOffForm.days_count}
                  onChange={(event) =>
                    setTimeOffForm({ ...timeOffForm, days_count: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={timeOffForm.status}
                  onValueChange={(value) =>
                    setTimeOffForm({ ...timeOffForm, status: value as TimeOffStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="time-off-notes">Notes</Label>
              <Textarea
                id="time-off-notes"
                value={timeOffForm.notes}
                onChange={(event) => setTimeOffForm({ ...timeOffForm, notes: event.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTimeOffDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTimeOff} disabled={saving || !timeOffForm.staff_id}>
              {saving ? "Saving..." : editingTimeOffId ? "Save Changes" : "Add Time Off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

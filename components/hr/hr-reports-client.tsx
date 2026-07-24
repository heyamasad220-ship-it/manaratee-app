"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getSelectedOrganizationIdClient } from "@/lib/organizations/get-selected-organization-id-client"
import {
  type DateRangeKey,
  type ReportStaffMember,
} from "@/lib/hr/hr-report-types"
import { PEOPLE_MANAGEMENT_MODULE_LABEL } from "@/lib/hr/hr-module-label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
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
import { Users, Building2, HeartHandshake, Baby } from "lucide-react"

function getRangeStart(dateRange: DateRangeKey) {
  const start = new Date()
  if (dateRange === "7d") start.setDate(start.getDate() - 7)
  else if (dateRange === "30d") start.setDate(start.getDate() - 30)
  else if (dateRange === "90d") start.setDate(start.getDate() - 90)
  else start.setFullYear(start.getFullYear() - 1)
  return start.toISOString().slice(0, 10)
}

function isDateInRange(value: string, rangeStart: string) {
  return value.slice(0, 10) >= rangeStart
}

/** People headcount dashboard for HR → Overview (formerly Reports). */
export function HrOverviewDashboard({
  organizationId,
  volunteerCount = 0,
  childcareProviderCount = 0,
}: {
  organizationId: string | null
  volunteerCount?: number
  childcareProviderCount?: number
}) {
  const supabase = createClient()

  const [resolvedOrganizationId, setResolvedOrganizationId] = useState<string | null>(organizationId)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRangeKey>("30d")

  const [staff, setStaff] = useState<ReportStaffMember[]>([])
  const [departmentCount, setDepartmentCount] = useState(0)

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
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const [staffResult, departmentsResult] = await Promise.all([
        supabase
          .from("staff")
          .select("id, first_name, last_name, staff_type, status, hire_date, department_id, departments(name)")
          .eq("organization_id", resolvedOrganizationId)
          .order("last_name", { ascending: true }),
        supabase
          .from("departments")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", resolvedOrganizationId),
      ])

      if (staffResult.error) throw staffResult.error
      if (departmentsResult.error) throw departmentsResult.error

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
    } catch (error: any) {
      console.error("HR overview load error:", error)
      alert(error?.message || `Could not load ${PEOPLE_MANAGEMENT_MODULE_LABEL.toLowerCase()} overview.`)
    } finally {
      setLoading(false)
    }
  }, [resolvedOrganizationId, supabase])

  useEffect(() => {
    void fetchReportData()
  }, [fetchReportData])

  const activeStaff = useMemo(() => staff.filter((person) => person.status === "active"), [staff])

  const newHiresThisPeriod = useMemo(
    () =>
      staff.filter((person) => person.hire_date && isDateInRange(person.hire_date, rangeStart)).length,
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

  const overviewStats = useMemo(() => {
    return {
      totalEmployees: activeStaff.length,
      newHires: newHiresThisPeriod,
      departments: departmentCount,
      avgPerDepartment:
        departmentCount > 0 ? Math.round((activeStaff.length / departmentCount) * 10) / 10 : 0,
    }
  }, [activeStaff, newHiresThisPeriod, departmentCount])

  if (loading) {
    return (
      <div className="space-y-6">
        <StatCardsRow equal columns={4}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </StatCardsRow>
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {!resolvedOrganizationId ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No organization ID was found. Overview cannot load until an organization is selected.
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Headcount for the selected period.
        </p>
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
      </div>

      <StatCardsRow equal columns={4}>
        <StatCard
          layout="header"
          fill
          tone="blue"
          label="Active Employees"
          value={overviewStats.totalEmployees}
          hint={`${overviewStats.newHires} new hire${overviewStats.newHires === 1 ? "" : "s"} this period`}
          icon={Users}
        />
        <StatCard
          layout="header"
          fill
          tone="emerald"
          label="Departments"
          value={overviewStats.departments}
          hint={`${overviewStats.avgPerDepartment} avg employees/dept`}
          icon={Building2}
        />
        <StatCard
          layout="header"
          fill
          tone="violet"
          label="Volunteers"
          value={volunteerCount}
          hint="Contact affiliations"
          icon={HeartHandshake}
        />
        <StatCard
          layout="header"
          fill
          tone="amber"
          label="Childcare Providers"
          value={childcareProviderCount}
          hint="Active providers"
          icon={Baby}
        />
      </StatCardsRow>

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
                    No active employees yet. Add employees under Employees.
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
    </div>
  )
}

/** @deprecated Use HrOverviewDashboard — Reports hub removed. */
export const HRReportsClient = HrOverviewDashboard

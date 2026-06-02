"use client"

import * as React from "react"
import Link from "next/link"
import {
  fetchDepartmentPreviews,
  fetchHrEmployeeDashboardStats,
  type DepartmentPreview,
  type HrEmployeeDashboardStats,
} from "@/lib/hr/hr-employee-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowRight, Briefcase, Building2, Users } from "lucide-react"

type HrEmployeesOverviewProps = {
  onManageDepartments?: () => void
  onManageEmployees?: () => void
}

export function HrEmployeesOverview({
  onManageDepartments,
  onManageEmployees,
}: HrEmployeesOverviewProps) {
  const [loading, setLoading] = React.useState(true)
  const [departments, setDepartments] = React.useState<DepartmentPreview[]>([])
  const [stats, setStats] = React.useState<HrEmployeeDashboardStats>({
    totalEmployees: 0,
    activeStaff: 0,
    totalDepartments: 0,
    totalPositions: 0,
  })

  React.useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [statsData, departmentsData] = await Promise.all([
        fetchHrEmployeeDashboardStats(),
        fetchDepartmentPreviews(),
      ])
      setStats(statsData)
      setDepartments(departmentsData)
    } catch (error: any) {
      console.error(error)
      alert(error?.message || "Could not load employee overview.")
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    { label: "Employee Contacts", value: stats.totalEmployees, icon: Users },
    { label: "Active Staff Records", value: stats.activeStaff, icon: Briefcase },
    { label: "Departments", value: stats.totalDepartments, icon: Building2 },
    { label: "Positions", value: stats.totalPositions, icon: Briefcase },
  ]

  const previewDepartments = departments.slice(0, 6)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="size-5 text-primary" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {onManageEmployees ? (
          <Button variant="outline" size="sm" onClick={onManageEmployees}>
            View Employees
            <ArrowRight className="ml-2 size-4" />
          </Button>
        ) : null}
        <Button variant="outline" size="sm" asChild>
          <Link href="/programs/instructors">Employee records &amp; assignments</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Departments at a Glance</CardTitle>
          {onManageDepartments ? (
            <Button variant="outline" size="sm" onClick={onManageDepartments}>
              Manage Departments
              <ArrowRight className="ml-2 size-4" />
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Programs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    Loading departments...
                  </TableCell>
                </TableRow>
              ) : previewDepartments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    No departments yet. Create departments in the Departments tab.
                  </TableCell>
                </TableRow>
              ) : (
                previewDepartments.map((department) => (
                  <TableRow key={department.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`inline-block size-3 rounded-full ${department.color}`} />
                        <span className="font-medium">{department.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{department.staff_count}</TableCell>
                    <TableCell>{department.programs_count}</TableCell>
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

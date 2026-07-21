"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, FileBarChart, Loader2, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DepartmentYearProgramRow } from "@/lib/departments/department-active-programs"
import {
  fetchDepartmentYearProgramsAction,
  fetchDepartmentYearReportAction,
  type DepartmentYearReport,
} from "@/lib/departments/department-year-actions"

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function DepartmentReportsPanel({
  departmentId,
}: {
  departmentId: string
  departmentName: string
}) {
  const [archived, setArchived] = useState<DepartmentYearProgramRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [report, setReport] = useState<DepartmentYearReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentYearProgramsAction(departmentId)
    if (!result.success) {
      setError(result.error)
      setArchived([])
    } else {
      setArchived(result.data.archivedPrograms)
    }
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    void loadList()
  }, [loadList])

  async function openReport(programId: string) {
    setSelectedId(programId)
    setReportLoading(true)
    setReport(null)
    const result = await fetchDepartmentYearReportAction(departmentId, programId)
    if (result.success) {
      setReport(result.report)
    } else {
      setError(result.error)
    }
    setReportLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading archived years...
      </div>
    )
  }

  if (selectedId) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={() => {
            setSelectedId(null)
            setReport(null)
          }}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to archived years
        </Button>

        {reportLoading || !report ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading report...
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">{report.programName}</h2>
                <Badge variant="secondary" className="capitalize">
                  {report.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Read-only year report · {report.startDate || "—"} → {report.endDate || "—"}
              </p>
            </div>

            <StatCardsRow equal columns={4}>
              <StatCard
                layout="header"
                fill
                tone="blue"
                label="Students"
                value={report.studentsCount}
              />
              <StatCard
                layout="header"
                fill
                tone="sky"
                label="Courses"
                value={report.offeringsCount}
              />
              <StatCard
                layout="header"
                fill
                tone="emerald"
                label="Payments received"
                value={formatMoney(report.totalPaymentsReceived)}
              />
              <StatCard
                layout="header"
                fill
                tone={report.remainingBalance > 0 ? "amber" : "emerald"}
                label="Remaining"
                value={formatMoney(report.remainingBalance)}
              />
            </StatCardsRow>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Financial summary</CardTitle>
                <CardDescription>
                  Course fees {formatMoney(report.totalCourseFees)} · Received{" "}
                  {formatMoney(report.totalPaymentsReceived)} · Balance{" "}
                  {formatMoney(report.remainingBalance)}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Students</CardTitle>
                <CardDescription>Roster snapshot for this archived year.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead className="text-right">Fee</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.roster.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground">
                          No enrollments.
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.roster.map((row, index) => (
                        <TableRow key={`${row.studentName}-${row.courseName}-${index}`}>
                          <TableCell>{row.studentName}</TableCell>
                          <TableCell>{row.courseName}</TableCell>
                          <TableCell className="text-right">
                            {formatMoney(row.courseFee)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatMoney(row.amountPaid)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <StatCardsRow equal columns={3}>
        <StatCard
          layout="header"
          fill
          tone="violet"
          label="Archived years"
          value={archived.length}
          icon={FileBarChart}
          hint="Closed academic years"
        />
        <StatCard
          layout="header"
          fill
          tone="blue"
          label="Enrollments"
          value={archived.reduce((sum, program) => sum + program.enrolled, 0)}
          icon={FileBarChart}
          hint="Across archived years"
        />
        <StatCard
          layout="header"
          fill
          tone="sky"
          label="Courses"
          value={archived.reduce((sum, program) => sum + program.offeringCount, 0)}
          icon={FileBarChart}
          hint="Offerings in archives"
        />
      </StatCardsRow>

      <div>
        <h2 className="text-lg font-semibold tracking-tight">Reports</h2>
        <p className="text-sm text-muted-foreground">
          Archived academic years. Open a year for a read-only students and payments
          report.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {archived.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No archived years</CardTitle>
            <CardDescription>
              When a Super Admin archives a year from Overview, it appears here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => void loadList()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {archived.map((program) => (
            <Card key={program.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{program.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {program.startDate || "—"} → {program.endDate || "—"} ·{" "}
                    {program.offeringCount} courses
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void openReport(program.id)}>
                  <FileBarChart className="mr-1.5 h-4 w-4" />
                  Open report
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

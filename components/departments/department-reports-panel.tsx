"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Download, FileBarChart, Loader2, RefreshCw } from "lucide-react"

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

function csvEscape(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function downloadYearReportCsv(report: DepartmentYearReport) {
  const lines: string[] = []
  lines.push("Section,Field,Value")
  lines.push(`Summary,Year,${csvEscape(report.programName)}`)
  lines.push(`Summary,Status,${csvEscape(report.status)}`)
  lines.push(`Summary,Start,${csvEscape(report.startDate)}`)
  lines.push(`Summary,End,${csvEscape(report.endDate)}`)
  lines.push(`Summary,Participants,${report.studentsCount}`)
  lines.push(`Summary,Courses,${report.offeringsCount}`)
  lines.push(`Summary,Teachers,${report.teachersCount}`)
  lines.push(`Summary,Course fees (total),${report.totalCourseFees}`)
  lines.push(`Summary,Collected (aggregate),${report.totalPaymentsReceived}`)
  lines.push(`Summary,Remaining balance (aggregate),${report.remainingBalance}`)
  lines.push(`Summary,Payroll paid,${report.totalPayrollPaid}`)
  lines.push(`Summary,Expenses,${report.totalExpenses}`)
  lines.push(`Summary,Net (collected - payroll - expenses),${report.net}`)
  lines.push("")
  lines.push("Participants,Participant,Course")
  for (const row of report.students) {
    lines.push(
      ["Participants", csvEscape(row.studentName), csvEscape(row.courseName)].join(",")
    )
  }
  lines.push("")
  lines.push("Teachers,Teacher,Courses,Total paid (year)")
  for (const row of report.teachers) {
    lines.push(
      [
        "Teachers",
        csvEscape(row.teacherName),
        csvEscape(row.courseName),
        row.amountPaid,
      ].join(",")
    )
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  const safeName = report.programName.replace(/[^\w\-]+/g, "_").slice(0, 60)
  anchor.download = `${safeName || "year"}-report.csv`
  anchor.click()
  URL.revokeObjectURL(url)
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
          Back to archive
        </Button>

        {reportLoading || !report ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading report...
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
              <Button type="button" variant="outline" onClick={() => downloadYearReportCsv(report)}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>

            <StatCardsRow equal columns={4}>
              <StatCard
                layout="header"
                fill
                tone="blue"
                label="Participants"
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
                tone="violet"
                label="Teachers"
                value={report.teachersCount}
              />
              <StatCard
                layout="header"
                fill
                tone={report.net >= 0 ? "emerald" : "amber"}
                label="Net"
                value={formatMoney(report.net)}
                hint="Collected − payroll − expenses"
              />
            </StatCardsRow>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Financial summary</CardTitle>
                <CardDescription>
                  Totals only. Participant payment detail is omitted for confidentiality.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Course fees</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {formatMoney(report.totalCourseFees)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Collected (aggregate)</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {formatMoney(report.totalPaymentsReceived)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Remaining balance</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {formatMoney(report.remainingBalance)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Payroll paid</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {formatMoney(report.totalPayrollPaid)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Expenses</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {formatMoney(report.totalExpenses)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Net</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {formatMoney(report.net)}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Participants</CardTitle>
                <CardDescription>
                  Roster-style enrollments (participant × course). No payment columns.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Participant</TableHead>
                      <TableHead>Course</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.students.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-muted-foreground">
                          No enrollments.
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.students.map((row, index) => (
                        <TableRow key={`${row.studentName}-${row.courseName}-${index}`}>
                          <TableCell>{row.studentName}</TableCell>
                          <TableCell>{row.courseName}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Teachers</CardTitle>
                <CardDescription>
                  Course instructors plus anyone with approved/paid payroll in this
                  year&apos;s dates. Multiple courses are listed together.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Courses</TableHead>
                      <TableHead className="text-right">Total paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.teachers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-muted-foreground">
                          No teachers or payroll for this year.
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.teachers.map((row, index) => (
                        <TableRow key={`${row.teacherName}-${index}`}>
                          <TableCell>{row.teacherName}</TableCell>
                          <TableCell>{row.courseName}</TableCell>
                          <TableCell className="text-right tabular-nums">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void openReport(program.id)}
                >
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

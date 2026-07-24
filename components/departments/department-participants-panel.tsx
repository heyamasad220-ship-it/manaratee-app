"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BookOpen, Download, Loader2, UserRound, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TableColumnHeaderFilter } from "@/components/ui/table-column-header-filter"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import {
  fetchDepartmentParticipantsAction,
  type DepartmentParticipantCourseOption,
  type DepartmentParticipantRow,
  type DepartmentParticipantYearOption,
} from "@/lib/departments/department-participants"
import {
  PROGRAM_LABEL,
  PROGRAM_LABEL_PLURAL,
  YEAR_SEASON_LABEL,
  YEAR_SEASON_LABEL_PLURAL,
} from "@/lib/programs/program-display-labels"

function formatDate(value: string | null) {
  if (!value) return "—"
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (match) {
    const date = new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    )
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
  }
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatStatus(status: string | null) {
  if (!status) return "—"
  return status.replace(/_/g, " ")
}

function matchesFilter(value: string | null | undefined, filter: string) {
  const needle = filter.trim().toLowerCase()
  if (!needle) return true
  return (value || "").toLowerCase().includes(needle)
}

function escapeCsv(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows.map((row) => row.map(escapeCsv).join(",")).join("\n")
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function DepartmentParticipantsPanel({
  departmentId,
  departmentName,
  initialYearProgramId = null,
}: {
  departmentId: string
  departmentName: string
  /** Prefill year/season filter (e.g. redirect from program Reports). */
  initialYearProgramId?: string | null
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [participants, setParticipants] = useState<DepartmentParticipantRow[]>([])
  const [years, setYears] = useState<DepartmentParticipantYearOption[]>([])
  const [courses, setCourses] = useState<DepartmentParticipantCourseOption[]>([])
  const [yearFilter, setYearFilter] = useState<string>(initialYearProgramId || "all")
  const [courseFilterSelect, setCourseFilterSelect] = useState<string>("all")
  const [includeInactive, setIncludeInactive] = useState(false)
  const [studentFilter, setStudentFilter] = useState("")
  const [studentFilterInput, setStudentFilterInput] = useState("")
  const [courseFilter, setCourseFilter] = useState("")
  const [courseFilterInput, setCourseFilterInput] = useState("")
  const [teacherFilter, setTeacherFilter] = useState("")
  const [teacherFilterInput, setTeacherFilterInput] = useState("")

  useEffect(() => {
    if (initialYearProgramId) {
      setYearFilter(initialYearProgramId)
    }
  }, [initialYearProgramId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentParticipantsAction(departmentId, {
      programId: yearFilter === "all" ? null : yearFilter,
      offeringId: courseFilterSelect === "all" ? null : courseFilterSelect,
      includeInactive,
    })
    if (!result.success) {
      setError(result.error)
      setParticipants([])
      setYears([])
      setCourses([])
      setLoading(false)
      return
    }
    setParticipants(result.participants)
    setYears(result.years)
    setCourses(result.courses)
    setLoading(false)
  }, [departmentId, yearFilter, courseFilterSelect, includeInactive])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (courseFilterSelect === "all") return
    if (!courses.some((course) => course.id === courseFilterSelect)) {
      setCourseFilterSelect("all")
    }
  }, [courses, courseFilterSelect])

  const filteredParticipants = useMemo(
    () =>
      participants.filter(
        (row) =>
          matchesFilter(row.studentName, studentFilter) &&
          matchesFilter(row.courseName, courseFilter) &&
          matchesFilter(row.teacherName, teacherFilter)
      ),
    [participants, studentFilter, courseFilter, teacherFilter]
  )

  const uniqueStudents = new Set(
    filteredParticipants
      .map((row) => row.studentContactId || row.studentName)
      .filter(Boolean)
  ).size
  const courseCount = new Set(
    filteredParticipants.map((row) => row.courseName).filter(Boolean)
  ).size
  const withTeacher = filteredParticipants.filter((row) => Boolean(row.teacherName)).length
  const pendingCount = filteredParticipants.filter((row) => {
    const status = (row.status || "").toLowerCase()
    return status === "pending" || status === "pending_payment"
  }).length
  const activeCount = filteredParticipants.filter((row) => {
    const status = (row.status || "").toLowerCase()
    return status === "enrolled" || status === "active"
  }).length

  const filtersActive =
    Boolean(studentFilter.trim()) ||
    Boolean(courseFilter.trim()) ||
    Boolean(teacherFilter.trim()) ||
    yearFilter !== "all" ||
    courseFilterSelect !== "all" ||
    includeInactive

  function handleExport() {
    downloadCsv(
      `${departmentName.replace(/[^\w-]+/g, "-").toLowerCase()}-enrollments.csv`,
      [
        [
          "Student",
          YEAR_SEASON_LABEL,
          PROGRAM_LABEL,
          "Teacher",
          "Status",
          "Parent",
          "Parent email",
          "Parent phone",
          "Registered",
        ],
        ...filteredParticipants.map((row) => [
          row.studentName,
          row.yearSeasonName,
          row.courseName,
          row.teacherName || "",
          row.status || "",
          row.parentName || "",
          row.parentEmail || "",
          row.parentPhone || "",
          row.registeredAt || "",
        ]),
      ]
    )
  }

  return (
    <div className="space-y-6">
      {!loading && !error ? (
        <StatCardsRow equal columns={6}>
          <StatCard
            layout="header"
            fill
            tone="blue"
            label="Enrollments"
            value={filteredParticipants.length}
            icon={Users}
            hint="Enrollment rows"
          />
          <StatCard
            layout="header"
            fill
            tone="sky"
            label="Students"
            value={uniqueStudents}
            icon={UserRound}
            hint="Unique students"
          />
          <StatCard
            layout="header"
            fill
            tone="violet"
            label={PROGRAM_LABEL_PLURAL}
            value={courseCount}
            icon={BookOpen}
            hint={`Distinct ${PROGRAM_LABEL_PLURAL.toLowerCase()}`}
          />
          <StatCard
            layout="header"
            fill
            tone="emerald"
            label="Active / enrolled"
            value={activeCount}
            icon={Users}
            hint="Enrolled / active"
          />
          <StatCard
            layout="header"
            fill
            tone="amber"
            label="Pending"
            value={pendingCount}
            icon={Users}
            hint="Awaiting completion"
          />
          <StatCard
            layout="header"
            fill
            tone="slate"
            label="With teacher"
            value={withTeacher}
            icon={Users}
            hint="Assigned instructor"
          />
        </StatCardsRow>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 pb-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" />
              Enrollments
            </CardTitle>
            <CardDescription>
              Students enrolled in {YEAR_SEASON_LABEL_PLURAL.toLowerCase()} for {departmentName}.
              Payment details stay in Programs billing.
              {filtersActive
                ? ` Showing ${filteredParticipants.length} of ${participants.length}.`
                : null}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={loading || filteredParticipants.length === 0}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-muted/20 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="roster-year">{YEAR_SEASON_LABEL}</Label>
              <select
                id="roster-year"
                value={yearFilter}
                onChange={(event) => {
                  setYearFilter(event.target.value)
                  setCourseFilterSelect("all")
                }}
                className="h-9 min-w-[14rem] rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">All {YEAR_SEASON_LABEL_PLURAL.toLowerCase()}</option>
                {years.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="roster-course">{PROGRAM_LABEL}</Label>
              <select
                id="roster-course"
                value={courseFilterSelect}
                onChange={(event) => setCourseFilterSelect(event.target.value)}
                className="h-9 min-w-[12rem] rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">All {PROGRAM_LABEL_PLURAL.toLowerCase()}</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                className="size-3.5"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
              />
              Include cancelled / withdrawn
            </label>
          </div>

          {loading ? (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading enrollments...
            </p>
          ) : error ? (
            <p className="py-6 text-sm text-destructive">{error}</p>
          ) : participants.length === 0 && !filtersActive ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No students registered in this department&apos;s open{" "}
              {YEAR_SEASON_LABEL_PLURAL.toLowerCase()} yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <TableColumnHeaderFilter
                        label="Student"
                        active={Boolean(studentFilter.trim())}
                      >
                        {({ close }) => (
                          <Input
                            placeholder="Search by name"
                            value={studentFilterInput}
                            onChange={(event) => {
                              setStudentFilterInput(event.target.value)
                              setStudentFilter(event.target.value)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                setStudentFilter(studentFilterInput)
                                close()
                              }
                            }}
                          />
                        )}
                      </TableColumnHeaderFilter>
                    </TableHead>
                    <TableHead>{YEAR_SEASON_LABEL}</TableHead>
                    <TableHead>
                      <TableColumnHeaderFilter
                        label={PROGRAM_LABEL}
                        active={Boolean(courseFilter.trim())}
                      >
                        {({ close }) => (
                          <Input
                            placeholder={`Search by ${PROGRAM_LABEL.toLowerCase()}`}
                            value={courseFilterInput}
                            onChange={(event) => {
                              setCourseFilterInput(event.target.value)
                              setCourseFilter(event.target.value)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                setCourseFilter(courseFilterInput)
                                close()
                              }
                            }}
                          />
                        )}
                      </TableColumnHeaderFilter>
                    </TableHead>
                    <TableHead>
                      <TableColumnHeaderFilter
                        label="Teacher"
                        active={Boolean(teacherFilter.trim())}
                      >
                        {({ close }) => (
                          <Input
                            placeholder="Search by teacher"
                            value={teacherFilterInput}
                            onChange={(event) => {
                              setTeacherFilterInput(event.target.value)
                              setTeacherFilter(event.target.value)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                setTeacherFilter(teacherFilterInput)
                                close()
                              }
                            }}
                          />
                        )}
                      </TableColumnHeaderFilter>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Parent / Guardian</TableHead>
                    <TableHead>Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParticipants.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No enrollments match these filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredParticipants.map((row) => (
                      <TableRow key={row.enrollmentId}>
                        <TableCell className="font-medium">
                          <div>
                            {row.studentContactId ? (
                              <Link
                                href={contactProfileHref(row.studentContactId)}
                                className="text-primary hover:underline"
                              >
                                {row.studentName}
                              </Link>
                            ) : (
                              row.studentName
                            )}
                          </div>
                          <Link
                            href={`/programs/registrations/${row.enrollmentId}`}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            View registration
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/programs/${row.programId}`}
                            className="text-primary hover:underline"
                          >
                            {row.yearSeasonName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {row.offeringId ? (
                            <Link
                              href={`/programs/${row.programId}/offerings/${row.offeringId}`}
                              className="text-primary hover:underline"
                            >
                              {row.courseName}
                            </Link>
                          ) : (
                            row.courseName
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.teacherName || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize font-normal">
                            {formatStatus(row.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.parentName ? (
                            <div>
                              <div>{row.parentName}</div>
                              {row.parentEmail ? (
                                <div className="text-xs">{row.parentEmail}</div>
                              ) : null}
                              {row.parentPhone ? (
                                <div className="text-xs">{row.parentPhone}</div>
                              ) : null}
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(row.registeredAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

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
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"

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
  embedded = false,
}: {
  departmentId: string
  departmentName: string
  /** Hide outer card title chrome when embedded in Participants tab. */
  embedded?: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [participants, setParticipants] = useState<DepartmentParticipantRow[]>([])
  const [years, setYears] = useState<DepartmentParticipantYearOption[]>([])
  const [courses, setCourses] = useState<DepartmentParticipantCourseOption[]>([])
  const [yearFilterSelect, setYearFilterSelect] = useState<string>("all")
  const [courseFilterSelect, setCourseFilterSelect] = useState<string>("all")
  const [includeInactive, setIncludeInactive] = useState(false)
  const [studentFilter, setStudentFilter] = useState("")
  const [studentFilterInput, setStudentFilterInput] = useState("")
  const [courseFilter, setCourseFilter] = useState("")
  const [courseFilterInput, setCourseFilterInput] = useState("")
  const [teacherFilter, setTeacherFilter] = useState("")
  const [teacherFilterInput, setTeacherFilterInput] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentParticipantsAction(departmentId, {
      programId: yearFilterSelect === "all" ? null : yearFilterSelect,
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
  }, [departmentId, yearFilterSelect, courseFilterSelect, includeInactive])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (yearFilterSelect === "all") return
    if (!years.some((year) => year.id === yearFilterSelect)) {
      setYearFilterSelect("all")
    }
  }, [years, yearFilterSelect])

  useEffect(() => {
    if (courseFilterSelect === "all") return
    if (!courses.some((course) => course.id === courseFilterSelect)) {
      setCourseFilterSelect("all")
    }
  }, [courses, courseFilterSelect])

  const programOptions = useMemo(() => {
    if (yearFilterSelect === "all") return courses
    return courses.filter((course) => course.programId === yearFilterSelect)
  }, [courses, yearFilterSelect])

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
    yearFilterSelect !== "all" ||
    courseFilterSelect !== "all" ||
    includeInactive

  function handleExport() {
    downloadCsv(
      `${departmentName.replace(/[^\w-]+/g, "-").toLowerCase()}-enrollments.csv`,
      [
        [
          "Participant",
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

  const rosterBody = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-muted/20 p-3">
        <div className="space-y-1.5">
          <Label htmlFor="roster-year">{YEAR_SEASON_LABEL}</Label>
          <select
            id="roster-year"
            value={yearFilterSelect}
            onChange={(event) => {
              setYearFilterSelect(event.target.value)
              setCourseFilterSelect("all")
            }}
            className="h-9 min-w-[12rem] rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">
              All {YEAR_SEASON_LABEL_PLURAL.toLowerCase()}
            </option>
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
            {programOptions.map((course) => (
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
        <div className="ml-auto pb-0.5">
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
        </div>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading roster...
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
                    label="Participant"
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
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No enrollments match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredParticipants.map((row) => (
                  <TableRow key={row.enrollmentId}>
                    <TableCell className="font-medium">
                      <div>{row.studentName}</div>
                      <Link
                        href={`/programs/registrations/${row.enrollmentId}`}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        View registration
                      </Link>
                    </TableCell>
                    <TableCell>
                      {row.offeringId ? (
                        <Link
                          href={programOfferingManageHref(
                            row.programId,
                            row.offeringId,
                            { departmentId }
                          )}
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
                      {row.parentName || row.parentContactId ? (
                        <div>
                          {row.parentContactId ? (
                            <Link
                              href={contactProfileHref(row.parentContactId)}
                              className="font-medium text-primary hover:underline"
                            >
                              {row.parentName || "View contact"}
                            </Link>
                          ) : (
                            <div className="font-medium text-foreground">
                              {row.parentName}
                            </div>
                          )}
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
    </div>
  )

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
            label="Participants"
            value={uniqueStudents}
            icon={UserRound}
            hint="Unique participants"
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

      {embedded ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Roster</h2>
            <p className="text-sm text-muted-foreground">
              Registered participants for {departmentName}. Payment details stay in
              Programs billing.
              {filtersActive
                ? ` Showing ${filteredParticipants.length} of ${participants.length}.`
                : null}
            </p>
          </div>
          {rosterBody}
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-col gap-3 space-y-0 pb-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" />
                Roster
              </CardTitle>
              <CardDescription>
                Participants enrolled in {YEAR_SEASON_LABEL_PLURAL.toLowerCase()} for{" "}
                {departmentName}. Payment details stay in Programs billing.
                {filtersActive
                  ? ` Showing ${filteredParticipants.length} of ${participants.length}.`
                  : null}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>{rosterBody}</CardContent>
        </Card>
      )}
    </div>
  )
}


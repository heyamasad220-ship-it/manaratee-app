"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BookOpen, Loader2, UserRound, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  type DepartmentParticipantRow,
} from "@/lib/departments/department-participants"

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

export function DepartmentParticipantsPanel({
  departmentId,
  departmentName,
}: {
  departmentId: string
  departmentName: string
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [participants, setParticipants] = useState<DepartmentParticipantRow[]>([])
  const [studentFilter, setStudentFilter] = useState("")
  const [studentFilterInput, setStudentFilterInput] = useState("")
  const [courseFilter, setCourseFilter] = useState("")
  const [courseFilterInput, setCourseFilterInput] = useState("")
  const [teacherFilter, setTeacherFilter] = useState("")
  const [teacherFilterInput, setTeacherFilterInput] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentParticipantsAction(departmentId)
    if (!result.success) {
      setError(result.error)
      setParticipants([])
      setLoading(false)
      return
    }
    setParticipants(result.participants)
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    void load()
  }, [load])

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
    filteredParticipants.map((row) => row.studentContactId).filter(Boolean)
  ).size
  const courses = new Set(
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
    Boolean(teacherFilter.trim())

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
            hint="Roster rows"
          />
          <StatCard
            layout="header"
            fill
            tone="sky"
            label="Students"
            value={uniqueStudents}
            icon={UserRound}
            hint="Unique contacts"
          />
          <StatCard
            layout="header"
            fill
            tone="violet"
            label="Courses"
            value={courses}
            icon={BookOpen}
            hint="Distinct courses"
          />
          <StatCard
            layout="header"
            fill
            tone="emerald"
            label="With teacher"
            value={withTeacher}
            icon={Users}
            hint="Assigned instructor"
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
            label="Active"
            value={activeCount}
            icon={Users}
            hint="Enrolled / active"
          />
        </StatCardsRow>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" />
            Rosters
          </CardTitle>
          <CardDescription>
            Students registered in courses for {departmentName} — names, courses, and teachers.
            Payment details stay in Programs billing; revenue still rolls into Financial Summary.
            {filtersActive
              ? ` Showing ${filteredParticipants.length} of ${participants.length}.`
              : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading rosters...
            </p>
          ) : error ? (
            <p className="py-6 text-sm text-destructive">{error}</p>
          ) : participants.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No students registered in this department&apos;s programs yet.
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
                    <TableHead>
                      <TableColumnHeaderFilter
                        label="Course"
                        active={Boolean(courseFilter.trim())}
                      >
                        {({ close }) => (
                          <Input
                            placeholder="Search by course"
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
                    <TableHead>Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParticipants.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No roster rows match these filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredParticipants.map((row) => (
                      <TableRow key={row.enrollmentId}>
                        <TableCell className="font-medium">
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
                            <Link
                              href={`/programs/${row.programId}`}
                              className="text-primary hover:underline"
                            >
                              {row.courseName}
                            </Link>
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

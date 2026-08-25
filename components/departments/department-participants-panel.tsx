"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { Download, Loader2, Users } from "lucide-react"

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
import { MoveEnrollmentOfferingDialog } from "@/components/programs/move-enrollment-offering-dialog"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { DEPARTMENT_OPEN_PROGRAM_STATUSES } from "@/lib/departments/department-program-statuses"
import {
  fetchDepartmentParticipantsAction,
  type DepartmentParticipantCourseOption,
  type DepartmentParticipantRow,
  type DepartmentParticipantYearOption,
} from "@/lib/departments/department-participants"
import {
  getMoveOfferingTargetsAction,
  moveEnrollmentToOfferingAction,
} from "@/lib/programs/move-enrollment-offering-actions"
import {
  canMoveEnrollmentStatus,
  type MoveOfferingTarget,
} from "@/lib/programs/move-enrollment-offering-shared"
import {
  PROGRAM_LABEL,
  PROGRAM_LABEL_PLURAL,
  YEAR_SEASON_LABEL,
  YEAR_SEASON_LABEL_PLURAL,
} from "@/lib/programs/program-display-labels"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import {
  DISPLAY_ENROLLMENT_STATUS_LABELS,
  DISPLAY_PAYMENT_STATUS_LABELS,
  displayEnrollmentStatus,
  displayEnrollmentStatusLabel,
  displayPaymentStatusLabel,
  enrollmentStatusBadgeClass,
  isCancelledEnrollmentStatus,
  paymentStatusBadgeClass,
  resolveDisplayPaymentStatus,
  type DisplayEnrollmentStatus,
  type DisplayPaymentStatus,
} from "@/lib/programs/enrollment-process"

import { cn } from "@/lib/utils"

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

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function rowPaymentStatus(row: DepartmentParticipantRow): DisplayPaymentStatus {
  return resolveDisplayPaymentStatus({
    paymentStatus: row.paymentStatus,
    paymentRequired: row.paymentRequired,
    totalAmount: row.totalAmount,
    amountPaid: row.amountPaid,
  })
}

function rowBalance(row: DepartmentParticipantRow) {
  return Math.max(Number(row.totalAmount || 0) - Number(row.amountPaid || 0), 0)
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
  programId = null,
  embedded = false,
  stageNav = null,
  showRoster = true,
  showKpis = true,
  alternateContent = null,
  applicationsCount = 0,
  approvedPendingCount = 0,
}: {
  departmentId: string
  departmentName: string
  /** Lock the list to one program (program workspace Registrations). */
  programId?: string | null
  /** Hide outer card title chrome when embedded in Registrations tab. */
  embedded?: boolean
  /** Rendered under KPI cards (e.g. Applications / Enrollments stage tabs). */
  stageNav?: ReactNode
  /** When false, hide the roster table (stats + stageNav still show). */
  showRoster?: boolean
  /** When false, parent renders compact attention metrics. */
  showKpis?: boolean
  /** Content shown instead of the roster when `showRoster` is false. */
  alternateContent?: ReactNode
  /** Pending applications (submitted) for KPI cards. */
  applicationsCount?: number
  /** Approved but not yet registered for KPI cards. */
  approvedPendingCount?: number
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [participants, setParticipants] = useState<DepartmentParticipantRow[]>([])
  const [years, setYears] = useState<DepartmentParticipantYearOption[]>([])
  const [courses, setCourses] = useState<DepartmentParticipantCourseOption[]>([])
  const [yearFilterSelect, setYearFilterSelect] = useState<string>(
    programId || "all"
  )
  const [courseFilterSelect, setCourseFilterSelect] = useState<string>("all")
  const [includeInactive, setIncludeInactive] = useState(Boolean(programId))
  const [enrollmentFilter, setEnrollmentFilter] = useState<
    "all" | DisplayEnrollmentStatus
  >("all")
  const [paymentFilter, setPaymentFilter] = useState<"all" | DisplayPaymentStatus>(
    "all"
  )
  const [studentFilter, setStudentFilter] = useState("")
  const [studentFilterInput, setStudentFilterInput] = useState("")
  const [courseFilter, setCourseFilter] = useState("")
  const [courseFilterInput, setCourseFilterInput] = useState("")
  const [teacherFilter, setTeacherFilter] = useState("")
  const [teacherFilterInput, setTeacherFilterInput] = useState("")
  const didDefaultYear = useRef(false)
  const destinationsCache = useRef(
    new Map<string, { programName: string; targets: MoveOfferingTarget[] }>()
  )
  const [moveTarget, setMoveTarget] = useState<DepartmentParticipantRow | null>(
    null
  )
  const [moveToOfferingId, setMoveToOfferingId] = useState("")
  const [moveBusy, setMoveBusy] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [moveDestinations, setMoveDestinations] = useState<MoveOfferingTarget[]>(
    []
  )
  const [moveDestinationsLoading, setMoveDestinationsLoading] = useState(false)
  const [moveProgramName, setMoveProgramName] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentParticipantsAction(departmentId, {
      programId: programId || (yearFilterSelect === "all" ? null : yearFilterSelect),
      offeringId: courseFilterSelect === "all" ? null : courseFilterSelect,
      includeInactive: programId ? true : includeInactive,
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
  }, [departmentId, programId, yearFilterSelect, courseFilterSelect, includeInactive])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (programId) {
      didDefaultYear.current = true
      setYearFilterSelect(programId)
      return
    }
    if (didDefaultYear.current || years.length === 0) return
    didDefaultYear.current = true
    const openYear = years.find((year) =>
      (DEPARTMENT_OPEN_PROGRAM_STATUSES as readonly string[]).includes(year.status)
    )
    if (openYear) {
      setYearFilterSelect(openYear.id)
    }
  }, [programId, years])

  useEffect(() => {
    if (programId) return
    if (yearFilterSelect === "all") return
    if (!years.some((year) => year.id === yearFilterSelect)) {
      setYearFilterSelect("all")
    }
  }, [years, yearFilterSelect, programId])

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

  const offeringCountByProgram = useMemo(() => {
    const map = new Map<string, number>()
    for (const course of courses) {
      map.set(course.programId, (map.get(course.programId) || 0) + 1)
    }
    return map
  }, [courses])

  const filteredParticipants = useMemo(
    () =>
      participants.filter((row) => {
        if (!matchesFilter(row.studentName, studentFilter)) return false
        if (!matchesFilter(row.courseName, courseFilter)) return false
        if (!matchesFilter(row.teacherName, teacherFilter)) return false
        const enrollment = displayEnrollmentStatus(row.status)
        if (enrollmentFilter !== "all" && enrollment !== enrollmentFilter) {
          return false
        }
        if (
          enrollmentFilter === "all" &&
          !includeInactive &&
          isCancelledEnrollmentStatus(row.status)
        ) {
          return false
        }
        const payment = rowPaymentStatus(row)
        if (paymentFilter === "balance_due") {
          return rowBalance(row) > 0.009
        }
        if (paymentFilter !== "all" && payment !== paymentFilter) {
          return false
        }
        return true
      }),
    [
      participants,
      studentFilter,
      courseFilter,
      teacherFilter,
      enrollmentFilter,
      paymentFilter,
      includeInactive,
    ]
  )

  const filtersActive =
    Boolean(studentFilter.trim()) ||
    Boolean(courseFilter.trim()) ||
    Boolean(teacherFilter.trim()) ||
    yearFilterSelect !== "all" ||
    courseFilterSelect !== "all" ||
    includeInactive

  function applyMoveDestinations(
    programName: string,
    targets: MoveOfferingTarget[],
    fromOfferingId: string
  ) {
    const destinations = targets.filter((target) => target.id !== fromOfferingId)
    setMoveProgramName(programName)
    setMoveDestinations(destinations)
    setMoveToOfferingId(destinations[0]?.id ?? "")
  }

  async function openMoveDialog(row: DepartmentParticipantRow) {
    if (!row.offeringId) return
    setMoveTarget(row)
    setMoveError(null)
    setMoveToOfferingId("")
    const cached = destinationsCache.current.get(row.programId)
    if (cached) {
      applyMoveDestinations(cached.programName, cached.targets, row.offeringId)
      return
    }
    setMoveDestinations([])
    setMoveDestinationsLoading(true)
    const result = await getMoveOfferingTargetsAction(row.programId)
    setMoveDestinationsLoading(false)
    if (!result.success) {
      setMoveError(result.error)
      return
    }
    destinationsCache.current.set(row.programId, {
      programName: result.programName,
      targets: result.targets,
    })
    applyMoveDestinations(result.programName, result.targets, row.offeringId)
  }

  function closeMoveDialog(open?: boolean) {
    if (open) return
    if (moveBusy) return
    setMoveTarget(null)
    setMoveError(null)
  }

  async function handleMoveStudent() {
    if (!moveTarget?.offeringId || !moveToOfferingId) return
    setMoveBusy(true)
    setMoveError(null)
    try {
      const result = await moveEnrollmentToOfferingAction({
        enrollmentId: moveTarget.enrollmentId,
        fromOfferingId: moveTarget.offeringId,
        toOfferingId: moveToOfferingId,
      })
      if (!result.success) {
        setMoveError(result.error)
        return
      }
      destinationsCache.current.delete(moveTarget.programId)
      setMoveTarget(null)
      setMoveToOfferingId("")
      await load()
    } catch (error) {
      setMoveError(
        error instanceof Error ? error.message : "Failed to move this student."
      )
    } finally {
      setMoveBusy(false)
    }
  }

  function handleExport() {
    downloadCsv(
      `${departmentName.replace(/[^\w-]+/g, "-").toLowerCase()}-enrollments.csv`,
      [
        [
          "Participant",
          PROGRAM_LABEL,
          "Teacher",
          "Enrollment status",
          "Payment status",
          "Amount",
          "Paid",
          "Balance",
          "Parent",
          "Parent email",
          "Parent phone",
          "Registered",
        ],
        ...filteredParticipants.map((row) => [
          row.studentName,
          row.courseName,
          row.teacherName || "",
          displayEnrollmentStatusLabel(row.status),
          displayPaymentStatusLabel(rowPaymentStatus(row)),
          String(row.totalAmount || 0),
          String(row.amountPaid || 0),
          String(rowBalance(row)),
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
        {programId ? null : (
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
        )}
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
        <div className="space-y-1.5">
          <Label htmlFor="roster-enrollment-status">Enrollment status</Label>
          <select
            id="roster-enrollment-status"
            value={enrollmentFilter}
            onChange={(event) =>
              setEnrollmentFilter(
                event.target.value as "all" | DisplayEnrollmentStatus
              )
            }
            className="h-9 min-w-[10rem] rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">All</option>
            {(
              Object.keys(DISPLAY_ENROLLMENT_STATUS_LABELS) as DisplayEnrollmentStatus[]
            ).map((status) => (
              <option key={status} value={status}>
                {DISPLAY_ENROLLMENT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="roster-payment-status">Payment status</Label>
          <select
            id="roster-payment-status"
            value={paymentFilter}
            onChange={(event) =>
              setPaymentFilter(
                event.target.value as "all" | DisplayPaymentStatus
              )
            }
            className="h-9 min-w-[10rem] rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">All payment statuses</option>
            <option value="paid">{DISPLAY_PAYMENT_STATUS_LABELS.paid}</option>
            <option value="partially_paid">
              {DISPLAY_PAYMENT_STATUS_LABELS.partially_paid}
            </option>
            <option value="payment_plan">
              {DISPLAY_PAYMENT_STATUS_LABELS.payment_plan}
            </option>
            <option value="balance_due">
              {DISPLAY_PAYMENT_STATUS_LABELS.balance_due}
            </option>
            <option value="overdue">{DISPLAY_PAYMENT_STATUS_LABELS.overdue}</option>
            <option value="waived">{DISPLAY_PAYMENT_STATUS_LABELS.waived}</option>
            <option value="refunded">
              {DISPLAY_PAYMENT_STATUS_LABELS.refunded}
            </option>
          </select>
        </div>
        {programId ? null : (
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              className="size-3.5"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            Include cancelled / withdrawn
          </label>
        )}
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
          No enrollments yet.
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
                <TableHead>Enrollment status</TableHead>
                <TableHead>Payment status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Parent / Guardian</TableHead>
                <TableHead>Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParticipants.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
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
                      <div className="flex flex-wrap items-center gap-x-2">
                        <Link
                          href={`/programs/registrations/${row.enrollmentId}`}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          View registration
                        </Link>
                        {row.offeringId &&
                        canMoveEnrollmentStatus(row.status) &&
                        (offeringCountByProgram.get(row.programId) || 0) >
                          1 ? (
                          <button
                            type="button"
                            className="text-xs text-sky-700 hover:underline"
                            onClick={() => void openMoveDialog(row)}
                          >
                            Move
                          </button>
                        ) : null}
                      </div>
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
                      <Badge
                        variant="secondary"
                        className={cn(
                          "font-normal",
                          enrollmentStatusBadgeClass(
                            displayEnrollmentStatus(row.status)
                          )
                        )}
                      >
                        {displayEnrollmentStatusLabel(row.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "font-normal",
                          paymentStatusBadgeClass(rowPaymentStatus(row))
                        )}
                      >
                        {displayPaymentStatusLabel(rowPaymentStatus(row))}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(row.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(row.amountPaid)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(rowBalance(row))}
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
      {showKpis && !loading && !error ? (
        <StatCardsRow equal columns={4}>
          <StatCard
            layout="compact"
            fill
            tone="emerald"
            label="Enrolled"
            value={filteredParticipants.filter((row) =>
              ["enrolled", "active"].includes((row.status || "").toLowerCase())
            ).length}
            valueClassName="text-xl"
          />
        </StatCardsRow>
      ) : null}

      {stageNav}

      {showRoster ? (
        embedded ? (
          <div className="space-y-3">{rosterBody}</div>
        ) : (
          <Card>
            <CardHeader className="flex flex-col gap-3 space-y-0 pb-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="size-4" />
                  Registrations
                </CardTitle>
                <CardDescription>
                  Participants enrolled in{" "}
                  {YEAR_SEASON_LABEL_PLURAL.toLowerCase()} for {departmentName}.
                  Payment details stay in Programs billing.
                  {filtersActive
                    ? ` Showing ${filteredParticipants.length} of ${participants.length}.`
                    : null}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>{rosterBody}</CardContent>
          </Card>
        )
      ) : (
        alternateContent
      )}

      <MoveEnrollmentOfferingDialog
        open={moveTarget !== null}
        studentName={moveTarget?.studentName || "student"}
        programName={moveProgramName || moveTarget?.yearSeasonName || "this year"}
        destinations={moveDestinations}
        selectedOfferingId={moveToOfferingId}
        onSelectedOfferingIdChange={setMoveToOfferingId}
        busy={moveBusy}
        loading={moveDestinationsLoading}
        error={moveError}
        onOpenChange={closeMoveDialog}
        onConfirm={() => void handleMoveStudent()}
      />
    </div>
  )
}


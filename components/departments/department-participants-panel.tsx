"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ChevronDown,
  Columns3,
  Download,
  Loader2,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ListPagination } from "@/components/ui/list-pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  YEAR_SEASON_LABEL,
  YEAR_SEASON_LABEL_PLURAL,
} from "@/lib/programs/program-display-labels"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import {
  DISPLAY_ENROLLMENT_STATUS_LABELS,
  displayEnrollmentStatus,
  displayEnrollmentStatusLabel,
  enrollmentStatusBadgeClass,
  isCancelledEnrollmentStatus,
  type DisplayEnrollmentStatus,
} from "@/lib/programs/enrollment-process"
import {
  DEFAULT_REGISTRATION_COLUMNS,
  FULL_REGISTRATION_EXPORT_COLUMNS,
  LOCKED_REGISTRATION_COLUMNS,
  REGISTRATION_COLUMN_DEFINITIONS,
  loadRegistrationColumns,
  saveRegistrationColumns,
  toggleRegistrationColumn,
  type RegistrationColumnId,
} from "@/lib/programs/registration-table-columns"
import {
  EMPTY_CELL,
  displayCell,
  getRegistrationCsvValue,
  getRegistrationDisplayValue,
  registrationDateKey,
} from "@/lib/programs/registration-table-values"
import {
  parseRegistrationStatusParam,
  programWorkspaceHref,
  type RegistrationStatusFilter,
} from "@/lib/programs/program-workspace-path"
import {
  DEFAULT_LIST_PAGE_SIZE,
  slicePageItems,
} from "@/lib/ui/list-pagination"
import { cn } from "@/lib/utils"

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

function tableHeaderLabel(id: RegistrationColumnId) {
  if (id === "participant") return "Participant"
  if (id === "status") return "Status"
  if (id === "registered") return "Registered"
  if (id === "actions") return "Actions"
  return (
    REGISTRATION_COLUMN_DEFINITIONS.find((column) => column.id === id)?.label ||
    id
  )
}

function EnrollmentOfferingSelect({
  row,
  departmentId,
  targets,
  busy,
  error,
  onSelect,
}: {
  row: DepartmentParticipantRow
  departmentId: string
  targets: MoveOfferingTarget[]
  busy: boolean
  error: string | null
  onSelect: (row: DepartmentParticipantRow, toOfferingId: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const destinations = targets.filter((target) => target.id !== row.offeringId)
  const canMove =
    Boolean(row.offeringId) &&
    canMoveEnrollmentStatus(row.status) &&
    destinations.length > 0

  if (!row.offeringId) {
    return <>{row.courseName}</>
  }

  const offeringLink = (
    <Link
      href={programOfferingManageHref(row.programId, row.offeringId, {
        departmentId,
      })}
      className="min-w-0 truncate text-primary hover:underline"
    >
      {row.courseName}
    </Link>
  )

  if (!canMove) {
    return offeringLink
  }

  const currentOption = targets.find((target) => target.id === row.offeringId) ?? {
    id: row.offeringId,
    name: row.courseName,
  }
  const options = [currentOption, ...destinations]

  return (
    <div className="max-w-[18rem] space-y-1">
      {busy ? (
        <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          <span className="truncate">Moving…</span>
        </span>
      ) : editing ? (
        <Select
          value={row.offeringId}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(false)
          }}
          onValueChange={(value) => {
            if (value && value !== row.offeringId) onSelect(row, value)
            setEditing(false)
          }}
        >
          <SelectTrigger
            size="sm"
            className="h-8 w-full min-w-[11rem] text-left"
            aria-label={`Change offering for ${row.studentName}`}
          >
            <span className="min-w-0 flex-1 truncate">{row.courseName}</span>
          </SelectTrigger>
          <SelectContent className="max-w-[min(90vw,28rem)]">
            {options.map((offering) => (
              <SelectItem
                key={offering.id}
                value={offering.id}
                className="whitespace-normal"
              >
                {offering.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="flex min-w-0 items-center gap-1.5">
          {offeringLink}
          <Badge
            asChild
            variant="outline"
            className="cursor-pointer px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <button
              type="button"
              aria-label={`Change offering for ${row.studentName}`}
              onClick={() => setEditing(true)}
            >
              Change
            </button>
          </Badge>
        </div>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

function RosterContactBlock({
  name,
  contactId,
  email,
  phone,
}: {
  name: string | null
  contactId: string | null
  email: string | null
  phone: string | null
}) {
  if (!name && !contactId && !email && !phone) return <>{EMPTY_CELL}</>
  return (
    <div>
      {contactId ? (
        <Link
          href={contactProfileHref(contactId)}
          className="font-medium text-primary hover:underline"
        >
          {name || "View contact"}
        </Link>
      ) : name ? (
        <div className="font-medium text-foreground">{name}</div>
      ) : null}
      {email ? (
        <div className="text-xs font-normal text-muted-foreground">{email}</div>
      ) : null}
      {phone ? (
        <div className="text-xs font-normal text-muted-foreground">{phone}</div>
      ) : null}
    </div>
  )
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
}: {
  departmentId: string
  departmentName: string
  programId?: string | null
  embedded?: boolean
  stageNav?: ReactNode
  showRoster?: boolean
  showKpis?: boolean
  alternateContent?: ReactNode
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [participants, setParticipants] = useState<DepartmentParticipantRow[]>([])
  const [years, setYears] = useState<DepartmentParticipantYearOption[]>([])
  const [courses, setCourses] = useState<DepartmentParticipantCourseOption[]>([])
  const [yearFilterSelect, setYearFilterSelect] = useState<string>(
    programId || "all"
  )
  const [includeInactive, setIncludeInactive] = useState(Boolean(programId))
  const [localEnrollmentFilter, setLocalEnrollmentFilter] = useState<
    "all" | DisplayEnrollmentStatus
  >("active")
  const [studentFilter, setStudentFilter] = useState("")
  const [teacherFilter, setTeacherFilter] = useState("all")
  const [localOfferingFilter, setLocalOfferingFilter] = useState("all")
  const [ageMin, setAgeMin] = useState("")
  const [ageMax, setAgeMax] = useState("")
  const [genderFilter, setGenderFilter] = useState("all")
  const [registeredFrom, setRegisteredFrom] = useState("")
  const [registeredTo, setRegisteredTo] = useState("")
  const [visibleColumns, setVisibleColumns] = useState<RegistrationColumnId[]>(
    DEFAULT_REGISTRATION_COLUMNS
  )
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE)
  const didDefaultYear = useRef(false)
  const destinationsCache = useRef(
    new Map<string, { programName: string; targets: MoveOfferingTarget[] }>()
  )
  const [targetsByProgram, setTargetsByProgram] = useState<
    Record<string, MoveOfferingTarget[]>
  >({})
  const [movingEnrollmentId, setMovingEnrollmentId] = useState<string | null>(
    null
  )
  const [moveError, setMoveError] = useState<{
    enrollmentId: string
    message: string
  } | null>(null)

  const urlStatus = parseRegistrationStatusParam(searchParams.get("status"))
  const urlOffering = searchParams.get("offering") || "all"
  const enrollmentFilter: RegistrationStatusFilter = programId
    ? urlStatus ?? "active"
    : localEnrollmentFilter
  const offeringFilter = programId ? urlOffering : localOfferingFilter

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentParticipantsAction(departmentId, {
      programId: programId || (yearFilterSelect === "all" ? null : yearFilterSelect),
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
  }, [departmentId, programId, yearFilterSelect, includeInactive])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setVisibleColumns(loadRegistrationColumns())
  }, [])

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
    const programIds = [
      ...new Set(participants.map((row) => row.programId).filter(Boolean)),
    ]
    if (programIds.length === 0) return
    let cancelled = false

    async function loadTargets() {
      const next: Record<string, MoveOfferingTarget[]> = {}
      for (const id of programIds) {
        const cached = destinationsCache.current.get(id)
        if (cached) {
          next[id] = cached.targets
          continue
        }
        const result = await getMoveOfferingTargetsAction(id)
        if (cancelled) return
        if (!result.success) continue
        destinationsCache.current.set(id, {
          programName: result.programName,
          targets: result.targets,
        })
        next[id] = result.targets
      }
      if (!cancelled) {
        setTargetsByProgram((current) => ({ ...current, ...next }))
      }
    }

    void loadTargets()
    return () => {
      cancelled = true
    }
  }, [participants])

  function updateWorkspaceFilters(next: {
    status?: RegistrationStatusFilter
    offeringId?: string
  }) {
    if (!programId) return
    const status = next.status ?? enrollmentFilter
    const offering = next.offeringId ?? offeringFilter
    router.replace(
      programWorkspaceHref(programId, {
        tab: "students",
        registrationStatus: status,
        offeringId: offering !== "all" ? offering : undefined,
      }),
      { scroll: false }
    )
  }

  function handleEnrollmentFilterChange(value: string) {
    const next = (value || "all") as RegistrationStatusFilter
    if (programId) {
      updateWorkspaceFilters({ status: next })
      return
    }
    setLocalEnrollmentFilter(next as "all" | DisplayEnrollmentStatus)
  }

  function handleOfferingFilterChange(value: string) {
    const next = value || "all"
    if (programId) {
      updateWorkspaceFilters({ offeringId: next })
      return
    }
    setLocalOfferingFilter(next)
  }

  const offeringOptions = useMemo(() => {
    const scopedProgramId =
      programId || (yearFilterSelect === "all" ? null : yearFilterSelect)
    return courses.filter((course) =>
      scopedProgramId ? course.programId === scopedProgramId : true
    )
  }, [courses, programId, yearFilterSelect])

  const teacherOptions = useMemo(() => {
    return [
      ...new Set(
        participants
          .map((row) => row.teacherName?.trim())
          .filter((name): name is string => Boolean(name))
      ),
    ].sort((a, b) => a.localeCompare(b))
  }, [participants])

  const genderOptions = useMemo(() => {
    return [
      ...new Set(
        participants
          .map((row) => row.gender?.trim())
          .filter((value): value is string => Boolean(value))
      ),
    ].sort((a, b) => a.localeCompare(b))
  }, [participants])

  const filteredParticipants = useMemo(() => {
    const minAge = ageMin.trim() === "" ? null : Number(ageMin)
    const maxAge = ageMax.trim() === "" ? null : Number(ageMax)
    return participants.filter((row) => {
      if (!matchesFilter(row.studentName, studentFilter)) {
        const alsoMatches =
          matchesFilter(row.studentEmail, studentFilter) ||
          matchesFilter(row.studentPhone, studentFilter) ||
          matchesFilter(row.parentName, studentFilter) ||
          matchesFilter(row.parentEmail, studentFilter) ||
          matchesFilter(row.parentPhone, studentFilter)
        if (!alsoMatches) return false
      }
      if (offeringFilter !== "all" && row.offeringId !== offeringFilter) {
        return false
      }
      if (teacherFilter === "unassigned") {
        if (row.teacherName?.trim()) return false
      } else if (teacherFilter !== "all" && row.teacherName !== teacherFilter) {
        return false
      }
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
      if (minAge != null && Number.isFinite(minAge)) {
        if (row.age == null || row.age < minAge) return false
      }
      if (maxAge != null && Number.isFinite(maxAge)) {
        if (row.age == null || row.age > maxAge) return false
      }
      if (genderFilter !== "all") {
        if ((row.gender || "").trim().toLowerCase() !== genderFilter.toLowerCase()) {
          return false
        }
      }
      const registeredKey = registrationDateKey(row.registeredAt)
      if (registeredFrom && (!registeredKey || registeredKey < registeredFrom)) {
        return false
      }
      if (registeredTo && (!registeredKey || registeredKey > registeredTo)) {
        return false
      }
      return true
    })
  }, [
    participants,
    studentFilter,
    offeringFilter,
    teacherFilter,
    enrollmentFilter,
    includeInactive,
    ageMin,
    ageMax,
    genderFilter,
    registeredFrom,
    registeredTo,
  ])

  const visibleSet = useMemo(() => new Set(visibleColumns), [visibleColumns])
  const tableColumns = REGISTRATION_COLUMN_DEFINITIONS.filter((column) =>
    visibleSet.has(column.id)
  )

  useEffect(() => {
    setPage(1)
  }, [
    studentFilter,
    offeringFilter,
    teacherFilter,
    enrollmentFilter,
    includeInactive,
    yearFilterSelect,
    ageMin,
    ageMax,
    genderFilter,
    registeredFrom,
    registeredTo,
  ])

  const pagedParticipants = useMemo(
    () => slicePageItems(filteredParticipants, page, pageSize),
    [filteredParticipants, page, pageSize]
  )

  const advancedFilterCount = [
    ageMin.trim(),
    ageMax.trim(),
    genderFilter !== "all" ? genderFilter : "",
    registeredFrom,
    registeredTo,
  ].filter(Boolean).length

  const filtersActive =
    Boolean(studentFilter.trim()) ||
    offeringFilter !== "all" ||
    teacherFilter !== "all" ||
    enrollmentFilter !== "active" ||
    (!programId && yearFilterSelect !== "all") ||
    (!programId && includeInactive) ||
    advancedFilterCount > 0

  function clearFilters() {
    setStudentFilter("")
    setTeacherFilter("all")
    setAgeMin("")
    setAgeMax("")
    setGenderFilter("all")
    setRegisteredFrom("")
    setRegisteredTo("")
    if (programId) {
      router.replace(
        programWorkspaceHref(programId, {
          tab: "students",
          registrationStatus: "all",
        }),
        { scroll: false }
      )
      return
    }
    setLocalEnrollmentFilter("all")
    setLocalOfferingFilter("all")
  }

  function handleColumnToggle(id: RegistrationColumnId, visible: boolean) {
    const next = toggleRegistrationColumn(visibleColumns, id, visible)
    setVisibleColumns(next)
    saveRegistrationColumns(next)
  }

  async function handleOfferingChange(
    row: DepartmentParticipantRow,
    toOfferingId: string
  ) {
    if (!row.offeringId || toOfferingId === row.offeringId) return
    setMovingEnrollmentId(row.enrollmentId)
    setMoveError(null)
    try {
      const result = await moveEnrollmentToOfferingAction({
        enrollmentId: row.enrollmentId,
        fromOfferingId: row.offeringId,
        toOfferingId,
      })
      if (!result.success) {
        setMoveError({
          enrollmentId: row.enrollmentId,
          message: result.error,
        })
        return
      }
      destinationsCache.current.delete(row.programId)
      await load()
      const refreshed = await getMoveOfferingTargetsAction(row.programId)
      if (refreshed.success) {
        destinationsCache.current.set(row.programId, {
          programName: refreshed.programName,
          targets: refreshed.targets,
        })
        setTargetsByProgram((current) => ({
          ...current,
          [row.programId]: refreshed.targets,
        }))
      }
    } catch (caught) {
      setMoveError({
        enrollmentId: row.enrollmentId,
        message:
          caught instanceof Error
            ? caught.message
            : "Failed to move this student.",
      })
    } finally {
      setMovingEnrollmentId(null)
    }
  }

  function exportFileName() {
    const programName =
      years.find((year) => year.id === (programId || yearFilterSelect))?.name ||
      departmentName
    return `${programName.replace(/[^\w-]+/g, "-").toLowerCase()}-registrations.csv`
  }

  function handleExport(mode: "view" | "full") {
    const columns =
      mode === "full"
        ? FULL_REGISTRATION_EXPORT_COLUMNS
        : tableColumns
            .map((column) => column.id)
            .filter((id) => id !== "actions")
    if (columns.length === 0) return
    downloadCsv(exportFileName(), [
      columns.map((id) => tableHeaderLabel(id)),
      ...filteredParticipants.map((row) =>
        columns.map((id) => getRegistrationCsvValue(row, id))
      ),
    ])
  }

  const hasUnassignedTeacher = participants.some((row) => !row.teacherName?.trim())

  const rosterBody = (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          {programId ? null : (
            <div className="space-y-1.5">
              <Label htmlFor="roster-year">{YEAR_SEASON_LABEL}</Label>
              <select
                id="roster-year"
                value={yearFilterSelect}
                onChange={(event) => {
                  setYearFilterSelect(event.target.value)
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
            <Label htmlFor="roster-search" className="sr-only">
              Search
            </Label>
            <Input
              id="roster-search"
              placeholder="Search by name"
              value={studentFilter}
              onChange={(event) => setStudentFilter(event.target.value)}
              className="h-9 w-[12rem] sm:w-[16rem]"
            />
          </div>
          <Select value={offeringFilter} onValueChange={handleOfferingFilterChange}>
            <SelectTrigger className="h-9 w-[12rem]" aria-label="Offering">
              <SelectValue placeholder="Offering" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All offerings</SelectItem>
              {offeringOptions.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={teacherFilter} onValueChange={setTeacherFilter}>
            <SelectTrigger className="h-9 w-[11rem]" aria-label="Teacher">
              <SelectValue placeholder="Teacher" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teachers</SelectItem>
              {hasUnassignedTeacher ? (
                <SelectItem value="unassigned">Unassigned</SelectItem>
              ) : null}
              {teacherOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={enrollmentFilter}
            onValueChange={handleEnrollmentFilterChange}
          >
            <SelectTrigger className="h-9 w-[10rem]" aria-label="Status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(
                Object.keys(
                  DISPLAY_ENROLLMENT_STATUS_LABELS
                ) as DisplayEnrollmentStatus[]
              ).map((status) => (
                <SelectItem key={status} value={status}>
                  {DISPLAY_ENROLLMENT_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
                {advancedFilterCount > 0 ? (
                  <span className="rounded-full bg-muted px-1.5 text-[11px]">
                    {advancedFilterCount}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="roster-age-min">Min age</Label>
                  <Input
                    id="roster-age-min"
                    type="number"
                    min={0}
                    max={120}
                    value={ageMin}
                    onChange={(event) => setAgeMin(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="roster-age-max">Max age</Label>
                  <Input
                    id="roster-age-max"
                    type="number"
                    min={0}
                    max={120}
                    value={ageMax}
                    onChange={(event) => setAgeMax(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={genderFilter} onValueChange={setGenderFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {genderOptions.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="roster-from">Registered from</Label>
                <Input
                  id="roster-from"
                  type="date"
                  value={registeredFrom}
                  onChange={(event) => setRegisteredFrom(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="roster-to">Registered to</Label>
                <Input
                  id="roster-to"
                  type="date"
                  value={registeredTo}
                  onChange={(event) => setRegisteredTo(event.target.value)}
                />
              </div>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5">
                <Columns3 className="h-3.5 w-3.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Participant</DropdownMenuLabel>
              {REGISTRATION_COLUMN_DEFINITIONS.filter(
                (column) => column.group === "participant"
              ).map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={visibleSet.has(column.id)}
                  disabled={LOCKED_REGISTRATION_COLUMNS.includes(column.id)}
                  onCheckedChange={(checked) =>
                    handleColumnToggle(column.id, Boolean(checked))
                  }
                  onSelect={(event) => event.preventDefault()}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Registration</DropdownMenuLabel>
              {REGISTRATION_COLUMN_DEFINITIONS.filter(
                (column) => column.group === "registration"
              ).map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={visibleSet.has(column.id)}
                  disabled={LOCKED_REGISTRATION_COLUMNS.includes(column.id)}
                  onCheckedChange={(checked) =>
                    handleColumnToggle(column.id, Boolean(checked))
                  }
                  onSelect={(event) => event.preventDefault()}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                disabled={loading || filteredParticipants.length === 0}
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("view")}>
                Export Current View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("full")}>
                Export Full Registration Data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {filtersActive ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5"
              onClick={clearFilters}
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </Button>
          ) : null}
        </div>
        {filtersActive ? (
          <p className="text-xs text-muted-foreground">
            Showing {filteredParticipants.length} of {participants.length}{" "}
            registrations
            {enrollmentFilter !== "all"
              ? ` · Status: ${
                  enrollmentFilter === "active"
                    ? "Enrolled"
                    : DISPLAY_ENROLLMENT_STATUS_LABELS[
                        enrollmentFilter as DisplayEnrollmentStatus
                      ] || enrollmentFilter
                }`
              : " · All statuses"}
            {offeringFilter !== "all"
              ? ` · Offering: ${
                  offeringOptions.find((course) => course.id === offeringFilter)
                    ?.name || "Selected"
                }`
              : ""}
          </p>
        ) : null}
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
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                {tableColumns.map((column, index) => (
                  <TableHead
                    key={column.id}
                    className={cn(
                      "whitespace-nowrap",
                      index === 0 &&
                        "sticky left-0 z-10 min-w-[14rem] bg-background",
                      column.id === "actions" && "w-[8rem]"
                    )}
                  >
                    {tableHeaderLabel(column.id)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParticipants.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={Math.max(tableColumns.length, 1)}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No enrollments match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                pagedParticipants.map((row) => (
                  <TableRow key={row.enrollmentId}>
                    {tableColumns.map((column, index) => (
                      <TableCell
                        key={column.id}
                        className={cn(
                          index === 0 &&
                            "sticky left-0 z-10 bg-background font-medium",
                          column.id !== "participant" &&
                            column.id !== "offering" &&
                            column.id !== "guardian" &&
                            column.id !== "status" &&
                            column.id !== "actions"
                            ? "text-muted-foreground"
                            : null
                        )}
                      >
                        <RegistrationCell
                          row={row}
                          columnId={column.id}
                          departmentId={departmentId}
                          targets={targetsByProgram[row.programId] || []}
                          busy={movingEnrollmentId === row.enrollmentId}
                          moveError={
                            moveError?.enrollmentId === row.enrollmentId
                              ? moveError.message
                              : null
                          }
                          showInlineContact={
                            !visibleSet.has("email") && !visibleSet.has("phone")
                          }
                          onSelect={(nextRow, toOfferingId) =>
                            void handleOfferingChange(nextRow, toOfferingId)
                          }
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && !error && filteredParticipants.length > 0 ? (
        <ListPagination
          page={page}
          pageSize={pageSize}
          total={filteredParticipants.length}
          entryLabel="registrations"
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setPageSize(next)
            setPage(1)
          }}
        />
      ) : null}
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
    </div>
  )
}

function RegistrationCell({
  row,
  columnId,
  departmentId,
  targets,
  busy,
  moveError,
  showInlineContact,
  onSelect,
}: {
  row: DepartmentParticipantRow
  columnId: RegistrationColumnId
  departmentId: string
  targets: MoveOfferingTarget[]
  busy: boolean
  moveError: string | null
  showInlineContact: boolean
  onSelect: (row: DepartmentParticipantRow, toOfferingId: string) => void
}) {
  if (columnId === "participant") {
    if (row.isYouth) {
      return (
        <div className="font-medium text-foreground">
          {row.studentName || EMPTY_CELL}
        </div>
      )
    }
    return (
      <RosterContactBlock
        name={row.studentName}
        contactId={row.studentContactId}
        email={showInlineContact ? row.studentEmail : null}
        phone={showInlineContact ? row.studentPhone : null}
      />
    )
  }

  if (columnId === "offering") {
    return (
      <EnrollmentOfferingSelect
        row={row}
        departmentId={departmentId}
        targets={targets}
        busy={busy}
        error={moveError}
        onSelect={onSelect}
      />
    )
  }

  if (columnId === "status") {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "font-normal",
          enrollmentStatusBadgeClass(displayEnrollmentStatus(row.status))
        )}
      >
        {displayEnrollmentStatusLabel(row.status)}
      </Badge>
    )
  }

  if (columnId === "guardian") {
    if (!row.showsGuardian) return EMPTY_CELL
    return (
      <RosterContactBlock
        name={row.parentName}
        contactId={row.parentContactId}
        email={showInlineContact ? row.parentEmail : null}
        phone={showInlineContact ? row.parentPhone : null}
      />
    )
  }

  if (columnId === "actions") {
    return (
      <Link
        href={`/programs/registrations/${row.enrollmentId}`}
        className="text-sm text-primary hover:underline"
      >
        View registration
      </Link>
    )
  }

  return displayCell(getRegistrationDisplayValue(row, columnId))
}

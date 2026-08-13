"use client"

import * as React from "react"
import { ClipboardCheck, ListOrdered, Loader2 } from "lucide-react"

import {
  OfferingBeforeAfterCarePanel,
  OfferingClassAttendancePanel,
  OfferingWaitlistPanel,
} from "@/components/programs/offering-operations-report-panels"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useProgramKindReportPreset } from "@/hooks/use-program-kind-report-preset"
import {
  getReportHierarchyLabels,
  PROGRAM_LABEL,
  YEAR_SEASON_LABEL,
} from "@/lib/programs/program-display-labels"
import type { ProgramKind } from "@/lib/programs/program-kind"
import { normalizeProgramKind } from "@/lib/programs/program-kind"
import { createClient } from "@/lib/supabase/client"

export type ReportOfferingOption = {
  id: string
  name: string
  programId: string
  programName: string
  programKind: ProgramKind
  departmentId: string | null
  departmentName: string | null
  attendanceTracked: boolean
  careEnabled: boolean
  waitlistEnabled: boolean
}

export type ReportDepartmentOption = {
  id: string
  name: string
}

async function loadReportOfferings(): Promise<ReportOfferingOption[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("program_offerings")
    .select(
      `
      id,
      name,
      program_id,
      attendance_tracked,
      care_enabled,
      enable_waitlist,
      status,
      program:program_id ( name, department_id, program_kind )
    `
    )
    .eq("status", "active")
    .order("name", { ascending: true })

  if (error) {
    console.warn("Could not load offerings for reports:", error.message)
    return []
  }

  const departmentIds = Array.from(
    new Set(
      (data || [])
        .map((row) => {
          const program = row.program as { department_id?: string | null } | null
          return program?.department_id || null
        })
        .filter((id): id is string => Boolean(id))
    )
  )

  const departmentNameById = new Map<string, string>()
  if (departmentIds.length > 0) {
    const { data: departments, error: departmentsError } = await supabase
      .from("departments")
      .select("id, name")
      .in("id", departmentIds)

    if (departmentsError) {
      console.warn(
        "Could not load departments for reports:",
        departmentsError.message
      )
    } else {
      for (const department of departments || []) {
        departmentNameById.set(
          department.id as string,
          (department.name as string) || "Department"
        )
      }
    }
  }

  return (data || []).map((row) => {
    const program = row.program as
      | {
          name?: string
          department_id?: string | null
          program_kind?: string | null
        }
      | null
    const departmentId = program?.department_id ?? null
    return {
      id: row.id as string,
      name: (row.name as string) || PROGRAM_LABEL,
      programId: row.program_id as string,
      programName: program?.name || YEAR_SEASON_LABEL,
      programKind: normalizeProgramKind(program?.program_kind),
      departmentId,
      departmentName: departmentId
        ? departmentNameById.get(departmentId) || null
        : null,
      attendanceTracked: Boolean(row.attendance_tracked),
      careEnabled: Boolean(row.care_enabled),
      waitlistEnabled: Boolean(row.enable_waitlist),
    }
  })
}

function departmentsFromOfferings(
  offerings: ReportOfferingOption[]
): ReportDepartmentOption[] {
  const byId = new Map<string, string>()
  for (const offering of offerings) {
    if (!offering.departmentId) continue
    if (!byId.has(offering.departmentId)) {
      byId.set(
        offering.departmentId,
        offering.departmentName || "Department"
      )
    }
  }
  return Array.from(byId.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function ReportFilters({
  departments,
  departmentId,
  onDepartmentChange,
  kindFilter,
  onKindChange,
  offerings,
  offeringId,
  onOfferingChange,
  offeringLabelSingular,
  offeringLabelPlural,
  loading,
}: {
  departments: ReportDepartmentOption[]
  departmentId: string
  onDepartmentChange: (departmentId: string) => void
  kindFilter: "all" | ProgramKind
  onKindChange: (kind: "all" | ProgramKind) => void
  offerings: ReportOfferingOption[]
  offeringId: string
  onOfferingChange: (offeringId: string) => void
  offeringLabelSingular: string
  offeringLabelPlural: string
  loading: boolean
}) {
  return (
    <div className="flex w-full flex-col gap-3 sm:max-w-3xl sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Label htmlFor="report-department-filter">Department</Label>
        <select
          id="report-department-filter"
          value={departmentId}
          onChange={(event) => onDepartmentChange(event.target.value)}
          disabled={loading || departments.length === 0}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All departments</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <Label htmlFor="report-kind-filter">Type</Label>
        <select
          id="report-kind-filter"
          value={kindFilter}
          onChange={(event) =>
            onKindChange(event.target.value as "all" | ProgramKind)
          }
          disabled={loading}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">All types</option>
          <option value="academic">Academic</option>
          <option value="seasonal">Seasonal</option>
        </select>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <Label htmlFor="report-offering-filter">{offeringLabelSingular}</Label>
        <select
          id="report-offering-filter"
          value={offeringId}
          onChange={(event) => onOfferingChange(event.target.value)}
          disabled={loading}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All {offeringLabelPlural.toLowerCase()}</option>
          {offerings.length === 0 ? (
            <option value="__none" disabled>
              No active {offeringLabelPlural.toLowerCase()}
            </option>
          ) : (
            offerings.map((offering) => (
              <option key={offering.id} value={offering.id}>
                {offering.name}
              </option>
            ))
          )}
        </select>
      </div>
    </div>
  )
}

function useReportOfferings() {
  const [loading, setLoading] = React.useState(true)
  const [offerings, setOfferings] = React.useState<ReportOfferingOption[]>([])
  const [departmentId, setDepartmentId] = React.useState("")
  const { kindFilter, setKindFilter } = useProgramKindReportPreset()
  const [selectedId, setSelectedId] = React.useState("")

  const reportLabels = getReportHierarchyLabels(
    kindFilter === "all" ? null : kindFilter
  )

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const rows = await loadReportOfferings()
      if (cancelled) return
      setOfferings(rows)
      setSelectedId((current) => {
        if (!current) return ""
        if (rows.some((row) => row.id === current)) return current
        return ""
      })
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const departments = React.useMemo(
    () => departmentsFromOfferings(offerings),
    [offerings]
  )

  const filteredOfferings = React.useMemo(() => {
    return offerings.filter((offering) => {
      if (departmentId && offering.departmentId !== departmentId) {
        return false
      }
      if (kindFilter !== "all" && offering.programKind !== kindFilter) {
        return false
      }
      return true
    })
  }, [offerings, departmentId, kindFilter])

  React.useEffect(() => {
    setSelectedId((current) => {
      if (!current) return ""
      if (filteredOfferings.some((row) => row.id === current)) return current
      return ""
    })
  }, [filteredOfferings])

  const selected =
    filteredOfferings.find((row) => row.id === selectedId) || null

  function handleDepartmentChange(nextDepartmentId: string) {
    setDepartmentId(nextDepartmentId)
  }

  function handleKindChange(next: "all" | ProgramKind) {
    setKindFilter(next)
    setSelectedId("")
  }

  return {
    loading,
    departments,
    departmentId,
    setDepartmentId: handleDepartmentChange,
    kindFilter,
    setKindFilter: handleKindChange,
    reportLabels,
    offerings: filteredOfferings,
    selected,
    selectedId,
    setSelectedId,
  }
}

/** Programs → Reports → Attendance (filter by department + offering). */
export function ProgramsAttendanceReportPanel() {
  const {
    loading,
    departments,
    departmentId,
    setDepartmentId,
    kindFilter,
    setKindFilter,
    reportLabels,
    offerings,
    selected,
    selectedId,
    setSelectedId,
  } = useReportOfferings()

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading programs…
      </div>
    )
  }

  if (offerings.length === 0 && !departmentId && kindFilter === "all") {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No active programs available. Create a program first, then enable
          attendance under Overview → Feature packs.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <ClipboardCheck className="h-5 w-5" />
            Attendance
          </h2>
          <p className="text-sm text-muted-foreground">
            Review class attendance by{" "}
            {reportLabels.offeringSingular.toLowerCase()}. Enable tracking on
            the {reportLabels.offeringSingular.toLowerCase()} Overview → Feature
            packs.
          </p>
        </div>
        <ReportFilters
          departments={departments}
          departmentId={departmentId}
          onDepartmentChange={setDepartmentId}
          kindFilter={kindFilter}
          onKindChange={setKindFilter}
          offerings={offerings}
          offeringId={selectedId}
          onOfferingChange={setSelectedId}
          offeringLabelSingular={reportLabels.offeringSingular}
          offeringLabelPlural={reportLabels.offeringPlural}
          loading={loading}
        />
      </div>

      {!selected ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {offerings.length === 0
              ? `No active ${reportLabels.offeringPlural.toLowerCase()} for this filter.`
              : `Select a ${reportLabels.offeringSingular.toLowerCase()} to review attendance.`}
          </CardContent>
        </Card>
      ) : (
        <>
          {selected.attendanceTracked ? (
            <OfferingClassAttendancePanel
              offeringId={selected.id}
              offeringName={selected.name}
            />
          ) : (
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Attendance tracking is off for{" "}
              <span className="font-medium text-foreground">
                {selected.name}
              </span>
              . Enable it on the {reportLabels.offeringSingular.toLowerCase()}{" "}
              Overview → Feature packs so teachers can mark attendance in My
              Classes.
            </div>
          )}

          {selected.careEnabled ? (
            <OfferingBeforeAfterCarePanel
              programId={selected.programId}
              offeringId={selected.id}
              offeringName={selected.name}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

/** Programs → Reports → Waitlist (filter by department + offering). */
export function ProgramsWaitlistReportPanel() {
  const {
    loading,
    departments,
    departmentId,
    setDepartmentId,
    kindFilter,
    setKindFilter,
    reportLabels,
    offerings,
    selected,
    selectedId,
    setSelectedId,
  } = useReportOfferings()

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading programs…
      </div>
    )
  }

  if (offerings.length === 0 && !departmentId && kindFilter === "all") {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No active programs available. Create a program and turn on waitlist
          under Enrollment when capacity is limited.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <ListOrdered className="h-5 w-5" />
            Waitlist
          </h2>
          <p className="text-sm text-muted-foreground">
            View waitlist entries by{" "}
            {reportLabels.offeringSingular.toLowerCase()}. Turn waitlist on or
            off under the {reportLabels.offeringSingular.toLowerCase()}{" "}
            Enrollment settings.
          </p>
        </div>
        <ReportFilters
          departments={departments}
          departmentId={departmentId}
          onDepartmentChange={setDepartmentId}
          kindFilter={kindFilter}
          onKindChange={setKindFilter}
          offerings={offerings}
          offeringId={selectedId}
          onOfferingChange={setSelectedId}
          offeringLabelSingular={reportLabels.offeringSingular}
          offeringLabelPlural={reportLabels.offeringPlural}
          loading={loading}
        />
      </div>

      {offerings.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No active {reportLabels.offeringPlural.toLowerCase()} for this
            filter.
          </CardContent>
        </Card>
      ) : selected ? (
        <>
          {!selected.waitlistEnabled ? (
            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Waitlist is off for{" "}
              <span className="font-medium text-foreground">
                {selected.name}
              </span>
              . Enable it on the {reportLabels.offeringSingular.toLowerCase()}{" "}
              Enrollment tab when you want a queue for full classes.
            </div>
          ) : null}

          <OfferingWaitlistPanel
            programId={selected.programId}
            offeringId={selected.id}
            offeringName={selected.name}
          />
        </>
      ) : (
        <OfferingWaitlistPanel
          programIds={Array.from(
            new Set(offerings.map((offering) => offering.programId))
          )}
          offeringIds={offerings.map((offering) => offering.id)}
          offeringName={`all ${reportLabels.offeringPlural.toLowerCase()}`}
        />
      )}
    </div>
  )
}

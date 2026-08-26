"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CalendarDays, ExternalLink, MapPin } from "lucide-react"

import { ProgramsScheduleBuilder } from "@/components/programs/programs-schedule-builder"
import { ScheduleListView } from "@/components/programs/schedule/schedule-list-view"
import { ScheduleViewToggle, type ScheduleBoardView } from "@/components/programs/schedule/schedule-view-toggle"
import { WeeklyScheduleBoard } from "@/components/programs/schedule/weekly-schedule-board"
import { WeeklyScheduleBoardSkeleton } from "@/components/programs/schedule/weekly-schedule-board-skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/states"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  fetchDepartmentScheduleAction,
  type DepartmentScheduleSummary,
  type DepartmentScheduleWeeklyRow,
} from "@/lib/departments/department-schedule"
import { eventManagementMasterCalendarHref } from "@/lib/events/event-management-section-path"
import {
  buildFacilitiesCalendarHref,
  CHECK_SPACE_AVAILABILITY_CTA_LABEL,
  VIEW_MASTER_CALENDAR_CTA_LABEL,
} from "@/lib/events/facility-event-request-href"
import { YEAR_SEASON_LABEL } from "@/lib/programs/program-display-labels"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"
import {
  buildWeeklyScheduleColumns,
  sortVisualScheduleItems,
  type VisualScheduleItem,
} from "@/lib/programs/weekly-schedule-board"

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

type ScheduleSection = "class-times" | "activity-planner"

function scheduleReturnTo(departmentId: string, programId?: string) {
  if (programId) {
    return programWorkspaceHref(programId, { tab: "schedule" })
  }
  return `/workforce/departments/${departmentId}?tab=programs`
}

function scheduleViewStorageKey(departmentId: string, programId?: string) {
  return programId
    ? `program-schedule-view:${programId}`
    : `department-schedule-view:${departmentId}`
}

function toVisualScheduleItem(
  row: DepartmentScheduleWeeklyRow,
  departmentId: string
): VisualScheduleItem {
  const spaceName = (row.spaceName || row.location || "").trim()
  return {
    id: row.id,
    offeringId: row.offeringId,
    offeringName: (row.offeringName || row.title || "Class").trim(),
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    instructorName: row.instructorName?.trim() || null,
    spaceName: spaceName || null,
    href: row.offeringId
      ? programOfferingManageHref(row.programId, row.offeringId, { departmentId })
      : null,
  }
}

export function DepartmentSchedulePanel({
  departmentId,
  departmentName,
  programId,
  programName,
  initialSection = "class-times",
  onSectionChange,
}: {
  departmentId: string
  departmentName: string
  programId?: string
  programName?: string
  initialSection?: ScheduleSection
  onSectionChange?: (section: ScheduleSection) => void
}) {
  const [section, setSection] = useState<ScheduleSection>(initialSection)
  const [view, setView] = useState<ScheduleBoardView>("board")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<DepartmentScheduleSummary | null>(null)
  const scopedToProgram = Boolean(programId)
  const scopeLabel = programName || departmentName
  const viewStorageKey = scheduleViewStorageKey(departmentId, programId)

  useEffect(() => {
    setSection(initialSection)
  }, [initialSection])

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(viewStorageKey)
      if (stored === "board" || stored === "list") setView(stored)
    } catch {
      // sessionStorage may be unavailable
    }
  }, [viewStorageKey])

  function handleViewChange(next: ScheduleBoardView) {
    setView(next)
    try {
      sessionStorage.setItem(viewStorageKey, next)
    } catch {
      // sessionStorage may be unavailable
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentScheduleAction(
      departmentId,
      programId ? { programId } : undefined
    )
    if (!result.success) {
      setError(result.error)
      setSummary(null)
      setLoading(false)
      return
    }
    setSummary(result.summary)
    setLoading(false)
  }, [departmentId, programId])

  useEffect(() => {
    void load()
  }, [load])

  function handleSectionChange(next: string) {
    const value = next === "activity-planner" ? "activity-planner" : "class-times"
    setSection(value)
    onSectionChange?.(value)
  }

  const returnTo = scheduleReturnTo(departmentId, programId)
  const spacesHref = buildFacilitiesCalendarHref({ returnTo })
  const masterCalendarHref = eventManagementMasterCalendarHref({
    departmentId,
    returnTo,
  })
  const offeringsHref = programId
    ? programWorkspaceHref(programId, { tab: "offerings" })
    : `/workforce/departments/${departmentId}?tab=programs`

  const visualItems = useMemo(
    () =>
      sortVisualScheduleItems(
        (summary?.weekly || []).map((row) =>
          toVisualScheduleItem(row, departmentId)
        )
      ),
    [departmentId, summary]
  )
  const boardColumns = useMemo(
    () => buildWeeklyScheduleColumns(visualItems),
    [visualItems]
  )
  const hasWeekly = visualItems.length > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Schedule</h2>
          <p className="text-sm text-muted-foreground">
            Class times and rooms for this{" "}
            {scopedToProgram ? "program's" : "department's"} offerings. Use
            Facilities to check building-wide space availability; Master Calendar
            for department events.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={spacesHref}>
              <MapPin className="mr-2 h-4 w-4" />
              {CHECK_SPACE_AVAILABILITY_CTA_LABEL}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={masterCalendarHref}>
              <CalendarDays className="mr-2 h-4 w-4" />
              {VIEW_MASTER_CALENDAR_CTA_LABEL}
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={section} onValueChange={handleSectionChange}>
        <TabsList>
          <TabsTrigger value="class-times">Class times</TabsTrigger>
          <TabsTrigger value="activity-planner">Activity planner</TabsTrigger>
        </TabsList>

        <TabsContent value="class-times" className="mt-4 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h3 className="text-base font-semibold tracking-tight">
                Weekly Class Schedule
              </h3>
              <p className="text-sm text-muted-foreground">
                Recurring class times, instructors, and spaces for this{" "}
                {scopedToProgram ? "program's" : "department's"} offerings.
              </p>
              <p className="text-xs text-muted-foreground">
                Schedule details are managed within each offering.
              </p>
            </div>
            {!loading && !error && hasWeekly ? (
              <ScheduleViewToggle value={view} onChange={handleViewChange} />
            ) : null}
          </div>

          {loading ? <WeeklyScheduleBoardSkeleton /> : null}

          {error ? <p className="py-6 text-sm text-destructive">{error}</p> : null}

          {!loading && !error && !hasWeekly ? (
            <EmptyState
              icon={<CalendarDays className="h-8 w-8 text-muted-foreground" />}
              title="No class times scheduled"
              description={
                scopedToProgram
                  ? "Class schedules will appear here after times are added to the program's offerings."
                  : `Class schedules will appear here after times are added to ${scopeLabel}'s offerings.`
              }
            >
              <Button variant="outline" asChild>
                <Link href={offeringsHref}>View Offerings</Link>
              </Button>
            </EmptyState>
          ) : null}

          {!loading && !error && hasWeekly && view === "board" ? (
            <WeeklyScheduleBoard columns={boardColumns} />
          ) : null}

          {!loading && !error && hasWeekly && view === "list" ? (
            <ScheduleListView items={visualItems} />
          ) : null}

          {!loading && !error && summary && summary.programs.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Sessions / terms</CardTitle>
                <CardDescription>
                  Date ranges for terms or camp sessions (capacity and enrollment).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {summary.sessions.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No sessions yet. Open an offering&apos;s Schedule tab to add terms.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Session</TableHead>
                          <TableHead>Program</TableHead>
                          {scopedToProgram ? null : (
                            <TableHead>{YEAR_SEASON_LABEL}</TableHead>
                          )}
                          <TableHead>Dates</TableHead>
                          <TableHead>Enrollment</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[100px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.sessions.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.offeringName || "—"}
                            </TableCell>
                            {scopedToProgram ? null : (
                              <TableCell className="text-muted-foreground">
                                {row.programName}
                              </TableCell>
                            )}
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(row.startDate)} – {formatDate(row.endDate)}
                            </TableCell>
                            <TableCell className="tabular-nums text-muted-foreground">
                              {row.enrolled}/{row.capacity || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className="capitalize font-normal"
                              >
                                {row.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {row.offeringId ? (
                                <Button type="button" size="sm" variant="outline" asChild>
                                  <Link
                                    href={programOfferingManageHref(
                                      row.programId,
                                      row.offeringId,
                                      { departmentId }
                                    )}
                                  >
                                    Edit
                                    <ExternalLink className="ml-1.5 size-3.5" />
                                  </Link>
                                </Button>
                              ) : (
                                <Button type="button" size="sm" variant="outline" asChild>
                                  <Link href={`/programs/${row.programId}/sessions`}>
                                    Edit
                                    <ExternalLink className="ml-1.5 size-3.5" />
                                  </Link>
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="activity-planner" className="mt-4">
          <ProgramsScheduleBuilder
            departmentId={departmentId}
            programId={programId}
            embedded
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CalendarDays, ExternalLink, Loader2, MapPin } from "lucide-react"

import { ProgramsScheduleBuilder } from "@/components/programs/programs-schedule-builder"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatDay(value: string) {
  if (!value) return "—"
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatTime(value: string) {
  if (!value) return "—"
  const match = /^(\d{1,2}):(\d{2})/.exec(value)
  if (!match) return value
  const hour = Number(match[1])
  const minute = match[2]
  const suffix = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute} ${suffix}`
}

function spaceOrLocationLabel(row: {
  spaceName: string | null
  location: string | null
}) {
  if (row.spaceName) return row.spaceName
  if (row.location) return row.location
  return "—"
}

type ScheduleSection = "class-times" | "activity-planner"

function scheduleReturnTo(departmentId: string, programId?: string) {
  if (programId) {
    return programWorkspaceHref(programId, { tab: "schedule" })
  }
  return `/workforce/departments/${departmentId}?tab=programs`
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<DepartmentScheduleSummary | null>(null)
  const scopedToProgram = Boolean(programId)
  const scopeLabel = programName || departmentName

  useEffect(() => {
    setSection(initialSection)
  }, [initialSection])

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
          {loading ? (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading schedule...
            </p>
          ) : null}

          {error ? <p className="py-6 text-sm text-destructive">{error}</p> : null}

          {!loading && !error && (!summary || summary.programs.length === 0) ? (
            <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              No schedule for {scopeLabel} yet. Add offerings and set weekly times on each
              offering&apos;s Schedule tab.
            </p>
          ) : null}

          {!loading && !error && summary && summary.programs.length > 0 ? (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Weekly class times</CardTitle>
                  <CardDescription>
                    Day, time, and space for recurring classes (from each offering). Assign rooms
                    on the offering Schedule tab.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {summary.weekly.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No weekly times yet. Open an offering&apos;s Schedule tab to add them.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Day</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Title</TableHead>
                            {scopedToProgram ? null : (
                              <TableHead>{YEAR_SEASON_LABEL}</TableHead>
                            )}
                            <TableHead>Program</TableHead>
                            <TableHead>Space</TableHead>
                            <TableHead>Instructor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summary.weekly.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">
                                {formatDay(row.dayOfWeek)}
                              </TableCell>
                              <TableCell className="tabular-nums text-muted-foreground">
                                {formatTime(row.startTime)} – {formatTime(row.endTime)}
                              </TableCell>
                              <TableCell>{row.title}</TableCell>
                              {scopedToProgram ? null : (
                                <TableCell className="text-muted-foreground">
                                  {row.programName}
                                </TableCell>
                              )}
                              <TableCell className="text-muted-foreground">
                                {row.offeringName || "—"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {spaceOrLocationLabel(row)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {row.instructorName || "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

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
            </>
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

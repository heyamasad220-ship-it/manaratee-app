"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CalendarClock, ExternalLink, Loader2, Users } from "lucide-react"

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
import {
  fetchDepartmentScheduleAction,
  type DepartmentScheduleSummary,
} from "@/lib/departments/department-schedule"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"

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

export function DepartmentSchedulePanel({
  departmentId,
  departmentName,
}: {
  departmentId: string
  departmentName: string
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<DepartmentScheduleSummary | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentScheduleAction(departmentId)
    if (!result.success) {
      setError(result.error)
      setSummary(null)
      setLoading(false)
      return
    }
    setSummary(result.summary)
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    void load()
  }, [load])

  const weeklyCount = summary?.weekly.length ?? 0
  const sessionsCount = summary?.sessions.length ?? 0
  const programsCount = summary?.programs.length ?? 0
  const seatsFilled =
    summary?.sessions.reduce((sum, session) => sum + Number(session.enrolled || 0), 0) ?? 0
  const capacity =
    summary?.sessions.reduce((sum, session) => sum + Number(session.capacity || 0), 0) ?? 0
  const openSeats = Math.max(0, capacity - seatsFilled)

  return (
    <div className="space-y-6">
      {!loading && !error && summary ? (
        <StatCardsRow equal columns={6}>
          <StatCard
            layout="header"
            fill
            tone="violet"
            label="Weekly slots"
            value={weeklyCount}
            icon={CalendarClock}
            hint="Recurring class times"
          />
          <StatCard
            layout="header"
            fill
            tone="blue"
            label="Sessions"
            value={sessionsCount}
            icon={CalendarClock}
            hint="Terms / camps"
          />
          <StatCard
            layout="header"
            fill
            tone="sky"
            label="Years/Seasons"
            value={programsCount}
            icon={CalendarClock}
            hint="With schedule"
          />
          <StatCard
            layout="header"
            fill
            tone="emerald"
            label="Seats filled"
            value={seatsFilled}
            icon={Users}
            hint="Across sessions"
          />
          <StatCard
            layout="header"
            fill
            tone="amber"
            label="Capacity"
            value={capacity}
            icon={Users}
            hint="Session seats"
          />
          <StatCard
            layout="header"
            fill
            tone="slate"
            label="Open seats"
            value={openSeats}
            icon={Users}
            hint="Capacity − filled"
          />
        </StatCardsRow>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4" />
              Schedule
            </CardTitle>
            <CardDescription>
              Weekly class times and session / term dates for programs in {departmentName}. Edit
              details from the offering Schedule tab.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading schedule...
            </p>
          ) : error ? (
            <p className="py-6 text-sm text-destructive">{error}</p>
          ) : !summary || summary.programs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No programs linked to this department yet. Add a program and offerings first, then
              set weekly times and sessions.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {summary.programs.map((program) => (
                <Button key={program.id} type="button" size="sm" variant="outline" asChild>
                  <Link
                    href={
                      program.defaultOfferingId
                        ? programOfferingManageHref(
                            program.id,
                            program.defaultOfferingId,
                            "schedule"
                          )
                        : `/programs/${program.id}`
                    }
                  >
                    Edit weekly schedule · {program.name}
                    <ExternalLink className="ml-1.5 size-3.5" />
                  </Link>
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && !error && summary ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Weekly class times</CardTitle>
              <CardDescription>Day, time, and location for recurring classes.</CardDescription>
            </CardHeader>
            <CardContent>
              {summary.weekly.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No weekly times yet. Use Edit weekly schedule above to add them.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Day</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Year/Season</TableHead>
                        <TableHead>Program</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Instructor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.weekly.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{formatDay(row.dayOfWeek)}</TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {formatTime(row.startTime)} – {formatTime(row.endTime)}
                          </TableCell>
                          <TableCell>{row.title}</TableCell>
                          <TableCell className="text-muted-foreground">{row.programName}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.offeringName || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.location || "—"}
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
                  No sessions yet. Open a program&apos;s Schedule tab to add terms.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Session</TableHead>
                        <TableHead>Program</TableHead>
                        <TableHead>Year/Season</TableHead>
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
                          <TableCell className="text-muted-foreground">{row.programName}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(row.startDate)} – {formatDate(row.endDate)}
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {row.enrolled}/{row.capacity || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize font-normal">
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
                                    "schedule"
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
    </div>
  )
}

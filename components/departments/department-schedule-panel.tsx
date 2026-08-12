"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { YEAR_SEASON_LABEL } from "@/lib/programs/program-display-labels"
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

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading schedule...
      </p>
    )
  }

  if (error) {
    return <p className="py-6 text-sm text-destructive">{error}</p>
  }

  if (!summary || summary.programs.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        No schedule for {departmentName} yet. Add offerings and set weekly times on each
        offering&apos;s Schedule tab.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Weekly class times</CardTitle>
          <CardDescription>Day, time, and location for recurring classes.</CardDescription>
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
                    <TableHead>{YEAR_SEASON_LABEL}</TableHead>
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
              No sessions yet. Open an offering&apos;s Schedule tab to add terms.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>{YEAR_SEASON_LABEL}</TableHead>
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
    </div>
  )
}

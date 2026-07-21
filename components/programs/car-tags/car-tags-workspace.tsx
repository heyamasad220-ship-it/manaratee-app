"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { CarTagSheet } from "@/components/programs/car-tags/car-tag-sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { CarTagRow } from "@/lib/programs/car-tag-types"
import type { ProgramSession } from "@/lib/programs/program-session-types"

type CapacityGroupOption = {
  id: string
  name: string
  grade_levels: string[]
}

export function CarTagsWorkspace({
  programId,
  programName,
  allRows,
  sessions,
  capacityGroups,
  initialSessionId,
  initialEnrollmentIds,
}: {
  programId: string
  programName: string
  allRows: CarTagRow[]
  sessions: ProgramSession[]
  capacityGroups: CapacityGroupOption[]
  initialSessionId?: string
  initialEnrollmentIds?: string[]
}) {
  const [sessionFilter, setSessionFilter] = React.useState(
    initialSessionId || ""
  )
  const [capacityGroupFilter, setCapacityGroupFilter] = React.useState("")

  const visibleRows = React.useMemo(() => {
    return allRows.filter((row) => {
      if (sessionFilter && !row.sessionIds.includes(sessionFilter)) {
        return false
      }

      if (capacityGroupFilter) {
        const group = capacityGroups.find((item) => item.id === capacityGroupFilter)
        if (!group) return true
        // Grade/group matching requires participant grade data (future).
        // For now, capacity group filter is a no-op placeholder when grades unavailable.
      }

      return true
    })
  }, [allRows, sessionFilter, capacityGroupFilter, capacityGroups])

  const preselectedIds = React.useMemo(() => {
    if (!initialEnrollmentIds?.length) return undefined
    const visibleIds = new Set(visibleRows.map((row) => row.enrollmentId))
    return initialEnrollmentIds.filter((id) => visibleIds.has(id))
  }, [initialEnrollmentIds, visibleRows])

  return (
    <div className="space-y-6">
      <div className="no-print">
        <Link
          href={`/programs/${programId}`}
          className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Program
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Car Name Tags
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {programName} · Pending, enrolled, and active participants only
            </p>
          </div>

          <Button variant="outline" size="sm" asChild>
            <Link href={`/programs/${programId}`}>View Program</Link>
          </Button>
        </div>
      </div>

      <div className="no-print rounded-lg border p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="car-tag-session-filter">Session / week</Label>
            <select
              id="car-tag-session-filter"
              value={sessionFilter}
              onChange={(event) => setSessionFilter(event.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">All sessions</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </select>
          </div>

          {capacityGroups.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="car-tag-group-filter">Capacity group</Label>
              <select
                id="car-tag-group-filter"
                value={capacityGroupFilter}
                onChange={(event) => setCapacityGroupFilter(event.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                disabled
                title="Grade matching for capacity groups will be added when participant grade is stored on enrollments."
              >
                <option value="">All groups (grade filter coming soon)</option>
                {capacityGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </div>

      <CarTagSheet tags={visibleRows} initialSelectedIds={preselectedIds} />
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarDays, Loader2, Plus } from "lucide-react"

import { InternalEventCardActions } from "@/components/events/internal-event-card-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import {
  fetchDepartmentActivityAction,
  type GroupActivityItem,
} from "@/lib/donations/donation-group-activity-actions"
import {
  buildFacilitiesBookSpaceHref,
  CREATE_EVENT_CTA_LABEL,
  VIEW_MASTER_CALENDAR_CTA_LABEL,
} from "@/lib/events/facility-event-request-href"
import { getInternalEventDeleteBlockersMap } from "@/lib/events/internal-event-actions"
import { getInternalEventStatusLabel } from "@/lib/events/internal-event-status"

type DepartmentEventsPanelProps = {
  departmentId: string
  departmentName: string
  canManageEvents?: boolean
  canRequestEvents?: boolean
  refreshToken?: number
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function startOfMonth() {
  const date = new Date()
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date
}

function departmentEventsReturnTo(departmentId: string) {
  return `/workforce/departments/${departmentId}?tab=activity`
}

function bookSpaceHref(departmentId: string) {
  return buildFacilitiesBookSpaceHref({
    departmentId,
    returnTo: departmentEventsReturnTo(departmentId),
    openNew: true,
  })
}

function collaborationCalendarHref(departmentId: string) {
  const params = new URLSearchParams({
    department: departmentId,
    returnTo: departmentEventsReturnTo(departmentId),
  })
  return `/event-management/calendar?${params.toString()}`
}

function eventIdFromItem(item: GroupActivityItem) {
  return item.id.replace(/^event-/, "")
}

export function DepartmentEventsPanel({
  departmentId,
  departmentName,
  canManageEvents = false,
  canRequestEvents = false,
  refreshToken = 0,
}: DepartmentEventsPanelProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<GroupActivityItem[]>([])
  const [deleteBlockers, setDeleteBlockers] = useState<Record<string, string | null>>({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      const result = await fetchDepartmentActivityAction(departmentId)

      if (!result.success) {
        setError(result.error)
        setItems([])
        setDeleteBlockers({})
        setLoading(false)
        return
      }

      setItems(result.items)

      if (canManageEvents && result.items.length > 0) {
        const blockers = await getInternalEventDeleteBlockersMap(
          result.items.map((item) => eventIdFromItem(item))
        )
        setDeleteBlockers(blockers)
      } else {
        setDeleteBlockers({})
      }

      setLoading(false)
    }

    void load()
  }, [departmentId, refreshToken, canManageEvents])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading events...
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  const today = startOfToday()
  const monthStart = startOfMonth()
  const upcomingCount = items.filter((item) => new Date(item.date) >= today).length
  const pastCount = items.length - upcomingCount
  const thisMonthCount = items.filter((item) => {
    const date = new Date(item.date)
    return date >= monthStart
  }).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Events</h2>
          <p className="text-sm text-muted-foreground">
            View the Master Calendar for department collaboration, then create events from
            Facilities (department and requester are prefilled). All submissions go for approval.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canRequestEvents || canManageEvents ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={collaborationCalendarHref(departmentId)}>
                <CalendarDays className="mr-2 h-4 w-4" />
                {VIEW_MASTER_CALENDAR_CTA_LABEL}
              </Link>
            </Button>
          ) : null}
          {canRequestEvents || canManageEvents ? (
            <Button size="sm" asChild>
              <Link href={bookSpaceHref(departmentId)}>
                <Plus className="mr-2 h-4 w-4" />
                {CREATE_EVENT_CTA_LABEL}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <StatCardsRow equal columns={4}>
        <StatCard
          layout="header"
          fill
          tone="violet"
          label="Events"
          value={items.length}
          icon={CalendarDays}
          hint="Department activity"
        />
        <StatCard
          layout="header"
          fill
          tone="blue"
          label="Upcoming"
          value={upcomingCount}
          icon={CalendarDays}
          hint="From today forward"
        />
        <StatCard
          layout="header"
          fill
          tone="slate"
          label="Past"
          value={pastCount}
          icon={CalendarDays}
          hint="Already occurred"
        />
        <StatCard
          layout="header"
          fill
          tone="emerald"
          label="This month"
          value={thisMonthCount}
          icon={CalendarDays}
          hint="Current calendar month"
        />
      </StatCardsRow>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Event list</CardTitle>
          <CardDescription>
            Open an event to manage ticketing, volunteers, and childcare. Gift totals stay under
            Group giving.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No events yet for this department.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => {
                const eventId = eventIdFromItem(item)
                const href = `/event-management/${eventId}`
                const statusValue = item.detail?.replace(/^Status:\s*/i, "") || null

                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-3 rounded-md border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <Link href={href} className="min-w-0 flex-1 hover:opacity-90">
                      <div className="flex items-start gap-3">
                        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(item.date)}
                          </p>
                        </div>
                      </div>
                    </Link>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {statusValue ? (
                        <Badge variant="outline">
                          {getInternalEventStatusLabel(statusValue)}
                        </Badge>
                      ) : null}
                      {canManageEvents ? (
                        <InternalEventCardActions
                          eventId={eventId}
                          eventName={item.title}
                          compact
                          deleteBlockedReason={deleteBlockers[eventId] ?? null}
                          redirectAfterDelete={departmentEventsReturnTo(departmentId)}
                        />
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

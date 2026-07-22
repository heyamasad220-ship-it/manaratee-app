"use client"

import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import type { ProgramScheduleItem } from "@/lib/programs/program-schedule-types"
import {
  PROGRAM_SCHEDULE_DAYS,
  type ProgramScheduleDayOfWeek,
} from "@/lib/programs/program-schedule-types"
import { cn } from "@/lib/utils"

const OFFERING_TYPE_LABELS: Record<string, string> = {
  standard: "Standard",
  academic_year: "Academic year",
  summer: "Summer",
  season: "Season",
  recurring: "Recurring",
}

const DAY_SHORT: Record<ProgramScheduleDayOfWeek, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
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

function weeksBetween(start: string | null, end: string | null) {
  if (!start || !end) return null
  const startMs = new Date(`${start}T00:00:00`).getTime()
  const endMs = new Date(`${end}T00:00:00`).getTime()
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null
  }
  const days = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24))
  return Math.max(1, Math.round(days / 7))
}

function uniqueOrderedDays(items: ProgramScheduleItem[]) {
  const present = new Set(items.map((item) => item.day_of_week))
  return PROGRAM_SCHEDULE_DAYS.filter((day) => present.has(day))
}

function summarizeTimes(items: ProgramScheduleItem[]) {
  if (items.length === 0) return "—"
  const labels = Array.from(
    new Set(
      items.map(
        (item) => `${formatTime(item.start_time)} – ${formatTime(item.end_time)}`
      )
    )
  )
  if (labels.length === 1) return labels[0]
  return "Multiple times"
}

function summarizeLocations(items: ProgramScheduleItem[]) {
  const locations = items
    .map((item) => item.location?.trim())
    .filter((value): value is string => Boolean(value))
  if (locations.length === 0) return "—"
  const unique = Array.from(new Set(locations))
  if (unique.length === 1) return unique[0]
  return "Multiple locations"
}

function estimateClassMeetings(
  weeks: number | null,
  dayCount: number
) {
  if (!weeks || dayCount === 0) return null
  return weeks * dayCount
}

function SummaryField({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm font-semibold text-foreground">{children}</div>
    </div>
  )
}

export function OfferingScheduleSummaryCard({
  offering,
  items,
  actions,
}: {
  offering: ProgramOffering
  items: ProgramScheduleItem[]
  actions?: ReactNode
}) {
  const weeks = weeksBetween(offering.start_date, offering.end_date)
  const days = uniqueOrderedDays(items)
  const meetings = estimateClassMeetings(weeks, days.length)
  const termLabel =
    OFFERING_TYPE_LABELS[offering.offering_type] || offering.offering_type

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-4">
        <div>
          <CardTitle className="text-base">Schedule</CardTitle>
          <p className="text-sm text-muted-foreground">
            When and where this offering meets.
          </p>
        </div>
        {actions}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryField label="Term">{termLabel}</SummaryField>
          <SummaryField label="Start Date">
            {formatDate(offering.start_date)}
          </SummaryField>
          <SummaryField label="End Date">
            {formatDate(offering.end_date)}
          </SummaryField>
          <SummaryField label="Duration">
            {weeks != null ? `${weeks} weeks` : "—"}
          </SummaryField>
        </div>

        <div className="border-t" />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryField label="Repeats">
            {items.length > 0 ? "Weekly" : "—"}
          </SummaryField>
          <SummaryField label="Days">
            {days.length === 0 ? (
              "—"
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {days.map((day) => (
                  <Badge
                    key={day}
                    variant="outline"
                    className="rounded-full border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700"
                  >
                    {DAY_SHORT[day]}
                  </Badge>
                ))}
              </div>
            )}
          </SummaryField>
          <SummaryField label="Time">{summarizeTimes(items)}</SummaryField>
          <SummaryField label="Location">
            {summarizeLocations(items)}
          </SummaryField>
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-semibold">
            {meetings != null
              ? `${meetings} class meeting${meetings === 1 ? "" : "s"}`
              : items.length > 0
                ? `${items.length} weekly time${items.length === 1 ? "" : "s"}`
                : "No weekly times yet"}
          </p>
          {items.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Add weekly meeting times to complete this schedule.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

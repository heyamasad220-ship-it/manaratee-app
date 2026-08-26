"use client"

import type { CSSProperties } from "react"

import { ScheduleDayColumn } from "@/components/programs/schedule/schedule-day-column"
import type { WeeklyScheduleDayColumn } from "@/lib/programs/weekly-schedule-board"
import { cn } from "@/lib/utils"

export function WeeklyScheduleBoard({
  columns,
}: {
  columns: WeeklyScheduleDayColumn[]
}) {
  const dayCount = Math.max(columns.length, 1)

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:overflow-x-auto lg:pb-1",
        "lg:[grid-template-columns:repeat(var(--schedule-day-count),minmax(13rem,1fr))]"
      )}
      style={
        {
          "--schedule-day-count": dayCount,
        } as CSSProperties
      }
      role="list"
      aria-label="Weekly class schedule"
    >
      {columns.map((column) => (
        <div key={column.dayOfWeek} role="listitem" className="min-w-0">
          <ScheduleDayColumn column={column} />
        </div>
      ))}
    </div>
  )
}

"use client"

import { CalendarDays } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ScheduleClassCard } from "@/components/programs/schedule/schedule-class-card"
import type { WeeklyScheduleDayColumn } from "@/lib/programs/weekly-schedule-board"
import { cn } from "@/lib/utils"

export function ScheduleDayColumn({
  column,
}: {
  column: WeeklyScheduleDayColumn
}) {
  const countLabel =
    column.items.length === 1 ? "1 class" : `${column.items.length} classes`

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl px-2 py-2 sm:px-3 sm:py-3",
        column.isToday && "bg-muted/40"
      )}
      aria-label={
        column.isToday ? `${column.label}, today` : column.label
      }
    >
      <header className="space-y-0.5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {column.label}
          </h3>
          {column.isToday ? (
            <Badge
              variant="secondary"
              className="px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
            >
              Today
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{countLabel}</p>
      </header>

      {column.items.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {column.items.map((item) => (
            <ScheduleClassCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
          <span>No classes scheduled</span>
        </div>
      )}
    </section>
  )
}

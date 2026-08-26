"use client"

import type { CSSProperties } from "react"

import { Skeleton } from "@/components/ui/skeleton"

export function WeeklyScheduleBoardSkeleton({
  dayCount = 5,
}: {
  dayCount?: number
}) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:[grid-template-columns:repeat(var(--schedule-day-count),minmax(13rem,1fr))]"
      style={
        {
          "--schedule-day-count": dayCount,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {Array.from({ length: dayCount }).map((_, dayIndex) => (
        <div key={dayIndex} className="space-y-3 rounded-xl px-3 py-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-[108px] w-full rounded-lg" />
          {dayIndex % 2 === 1 ? (
            <Skeleton className="h-[108px] w-full rounded-lg" />
          ) : null}
        </div>
      ))}
    </div>
  )
}

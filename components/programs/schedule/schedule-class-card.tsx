"use client"

import Link from "next/link"
import { MapPin, User } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getOfferingScheduleColor } from "@/lib/programs/offering-schedule-color"
import {
  formatScheduleDay,
  formatScheduleTimeRange,
  type VisualScheduleItem,
} from "@/lib/programs/weekly-schedule-board"
import { cn } from "@/lib/utils"

function AssignmentLine({
  icon: Icon,
  label,
  missing,
}: {
  icon: typeof User
  label: string
  missing: boolean
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-1.5 text-xs leading-snug",
        missing
          ? "text-amber-800/90 dark:text-amber-200/80"
          : "text-muted-foreground"
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-3.5 shrink-0",
          missing ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
        )}
        aria-hidden="true"
      />
      <span>{label}</span>
    </p>
  )
}

export function ScheduleClassCard({ item }: { item: VisualScheduleItem }) {
  const color = getOfferingScheduleColor(item.offeringId)
  const timeLabel = formatScheduleTimeRange(item.startTime, item.endTime)
  const instructorMissing = !item.instructorName
  const spaceMissing = !item.spaceName
  const instructorLabel = item.instructorName || "Teacher not assigned"
  const spaceLabel = item.spaceName || "Room not assigned"
  const dayLabel = formatScheduleDay(item.dayOfWeek)
  const accessibleName = [item.offeringName, timeLabel, instructorLabel, spaceLabel]
    .filter(Boolean)
    .join(", ")

  const body = (
    <>
      {timeLabel ? (
        <p className="text-xs font-semibold tracking-tight text-foreground">
          {timeLabel}
        </p>
      ) : null}
      <p className="text-sm font-semibold leading-snug text-foreground">
        {item.offeringName}
      </p>
      <div className="space-y-1">
        <AssignmentLine
          icon={User}
          label={instructorLabel}
          missing={instructorMissing}
        />
        <AssignmentLine
          icon={MapPin}
          label={spaceLabel}
          missing={spaceMissing}
        />
      </div>
    </>
  )

  const className = cn(
    "flex flex-col gap-2 rounded-lg border-y border-r border-border/60 border-l-4 p-3 text-left shadow-none",
    "transition-[box-shadow,border-color] duration-150",
    color.cardClassName,
    color.borderClassName,
    item.href &&
      "cursor-pointer hover:border-y-border hover:border-r-border hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  )

  const tooltipBody = (
    <div className="space-y-1 text-left">
      <p className="font-medium">{item.offeringName}</p>
      {dayLabel && timeLabel ? (
        <p>
          {dayLabel} · {timeLabel}
        </p>
      ) : null}
      <p>{instructorLabel}</p>
      <p>{spaceLabel}</p>
    </div>
  )

  const card = item.href ? (
    <Link href={item.href} className={className} aria-label={accessibleName}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {tooltipBody}
      </TooltipContent>
    </Tooltip>
  )
}

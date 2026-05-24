"use client"

import * as React from "react"
import { Clock, MapPin, Pencil, Trash2, User, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { deleteScheduleItem } from "@/lib/programs/program-schedule-actions"
import { ScheduleForm } from "./schedule-form"

type ScheduleItemCardProps = {
  programId: string
  item: {
    id: string
    title: string
    day_of_week: string
    start_time: string
    end_time: string
    location: string | null
    instructor_name: string | null
    capacity: number | null
    color: string
  }
}

const colorStyles: Record<string, string> = {
  "bg-blue-500": "border-blue-200 bg-blue-50 text-blue-950",
  "bg-green-500": "border-green-200 bg-green-50 text-green-950",
  "bg-purple-500": "border-purple-200 bg-purple-50 text-purple-950",
  "bg-amber-500": "border-amber-200 bg-amber-50 text-amber-950",
  "bg-red-500": "border-red-200 bg-red-50 text-red-950",
  "bg-pink-500": "border-pink-200 bg-pink-50 text-pink-950",
  "bg-teal-500": "border-teal-200 bg-teal-50 text-teal-950",
}

const dotStyles: Record<string, string> = {
  "bg-blue-500": "bg-blue-500",
  "bg-green-500": "bg-green-500",
  "bg-purple-500": "bg-purple-500",
  "bg-amber-500": "bg-amber-500",
  "bg-red-500": "bg-red-500",
  "bg-pink-500": "bg-pink-500",
  "bg-teal-500": "bg-teal-500",
}

function formatTime(value?: string | null) {
  if (!value) return ""

  const cleaned = value.trim().toUpperCase()

  if (cleaned.includes("AM") || cleaned.includes("PM")) {
    return cleaned
  }

  const parts = value.split(":")

  if (parts.length < 2) {
    return value
  }

  let hour = Number(parts[0])
  const minute = parts[1]

  if (Number.isNaN(hour)) {
    return value
  }

  const period = hour >= 12 ? "PM" : "AM"

  if (hour === 0) {
    hour = 12
  } else if (hour > 12) {
    hour -= 12
  }

  return `${hour}:${minute} ${period}`
}

export function ScheduleItemCard({ programId, item }: ScheduleItemCardProps) {
  const [isEditing, setIsEditing] = React.useState(false)

  const cardColorClass =
    colorStyles[item.color] || "border-blue-200 bg-blue-50 text-blue-950"

  const dotColorClass = dotStyles[item.color] || "bg-blue-500"

  return (
    <>
      <div className={cn("rounded-lg border p-3 shadow-sm", cardColorClass)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full", dotColorClass)} />
              <p className="truncate text-sm font-semibold">{item.title}</p>
            </div>

            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {formatTime(item.start_time)} - {formatTime(item.end_time)}
              </p>

              {item.instructor_name && (
                <p className="flex items-center gap-1.5">
                  <User className="h-3 w-3" />
                  {item.instructor_name}
                </p>
              )}

              {item.location && (
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" />
                  {item.location}
                </p>
              )}

              {item.capacity ? (
                <p className="flex items-center gap-1.5">
                  <Users className="h-3 w-3" />
                  Capacity: {item.capacity}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>

            <form
              action={async () => {
                await deleteScheduleItem(item.id, programId)
              }}
            >
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        </div>
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Edit Schedule Item</DialogTitle>
          </DialogHeader>

          <ScheduleForm
            programId={programId}
            item={item}
            onSuccess={() => setIsEditing(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
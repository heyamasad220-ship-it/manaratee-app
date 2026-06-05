"use client"

import { CalendarIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { EditSectionCard } from "./edit-section-card"

type ProgramDatesDefaults = {
  start_date?: string | null
  end_date?: string | null
  enrollment_open_date?: string | null
  enrollment_close_date?: string | null
}

export function ProgramDatesSection({
  program = null,
}: {
  program?: ProgramDatesDefaults | null
}) {
  return (
    <EditSectionCard
      title="Dates"
      description="Program dates and enrollment window."
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="start_date">Start Date</Label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="start_date"
              name="start_date"
              type="date"
              className="h-9 pl-9"
              defaultValue={program?.start_date || ""}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="end_date">End Date</Label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="end_date"
              name="end_date"
              type="date"
              className="h-9 pl-9"
              defaultValue={program?.end_date || ""}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="enrollment_open_date">Enrollment Open Date</Label>
          <Input
            id="enrollment_open_date"
            name="enrollment_open_date"
            type="date"
            className="h-9"
            defaultValue={program?.enrollment_open_date || ""}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="enrollment_close_date">Enrollment Close Date</Label>
          <Input
            id="enrollment_close_date"
            name="enrollment_close_date"
            type="date"
            className="h-9"
            defaultValue={program?.enrollment_close_date || ""}
          />
        </div>
      </div>
    </EditSectionCard>
  )
}

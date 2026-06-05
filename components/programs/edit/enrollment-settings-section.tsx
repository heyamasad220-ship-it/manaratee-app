"use client"

import { CalendarIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { EditSectionCard } from "./edit-section-card"

type EnrollmentDefaults = {
  enrollment_open_date?: string | null
  enrollment_close_date?: string | null
}

export function EnrollmentSettingsSection({
  program = null,
  description,
  enrollmentOpenDate,
  enrollmentCloseDate,
  onEnrollmentOpenDateChange,
  onEnrollmentCloseDateChange,
}: {
  program?: EnrollmentDefaults | null
  description?: string
  enrollmentOpenDate?: string
  enrollmentCloseDate?: string
  onEnrollmentOpenDateChange?: (value: string) => void
  onEnrollmentCloseDateChange?: (value: string) => void
}) {
  const openDate =
    enrollmentOpenDate ?? program?.enrollment_open_date ?? ""
  const closeDate =
    enrollmentCloseDate ?? program?.enrollment_close_date ?? ""
  const isControlled = onEnrollmentOpenDateChange !== undefined

  return (
    <EditSectionCard
      title="Enrollment"
      description={description || "Enrollment window for this program."}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="enrollment_open_date">Enrollment Open Date</Label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="enrollment_open_date"
              name={isControlled ? undefined : "enrollment_open_date"}
              type="date"
              className="h-9 bg-background pl-9"
              value={isControlled ? openDate : undefined}
              defaultValue={isControlled ? undefined : openDate || ""}
              onChange={
                onEnrollmentOpenDateChange
                  ? (event) => onEnrollmentOpenDateChange(event.target.value)
                  : undefined
              }
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="enrollment_close_date">Enrollment Close Date</Label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="enrollment_close_date"
              name={isControlled ? undefined : "enrollment_close_date"}
              type="date"
              className="h-9 bg-background pl-9"
              value={isControlled ? closeDate : undefined}
              defaultValue={isControlled ? undefined : closeDate || ""}
              onChange={
                onEnrollmentCloseDateChange
                  ? (event) => onEnrollmentCloseDateChange(event.target.value)
                  : undefined
              }
            />
          </div>
        </div>
      </div>
    </EditSectionCard>
  )
}

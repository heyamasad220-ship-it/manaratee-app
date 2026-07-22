"use client"

import { CalendarIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

import { EditSectionCard } from "./edit-section-card"

export type EnrollmentTypeId =
  | "full_program"
  | "selected_sessions"
  | "single_session"

const ENROLLMENT_TYPE_OPTIONS: Array<{
  value: EnrollmentTypeId
  label: string
}> = [
  {
    value: "full_program",
    label: "Entire Program",
  },
  {
    value: "selected_sessions",
    label: "Selected Sessions",
  },
  {
    value: "single_session",
    label: "Single Session",
  },
]

export function OfferingEnrollmentWindowCard({
  fullProgramEnabled,
  sessionRegistrationEnabled,
  singleSessionEnabled,
  onFullProgramChange,
  onSessionRegistrationChange,
  onSingleSessionChange,
  enrollmentOpenDate,
  enrollmentCloseDate,
  onEnrollmentOpenDateChange,
  onEnrollmentCloseDateChange,
  registrationOpen,
  enableWaitlist,
  onEnableWaitlistChange,
  inheritDates,
  inheritEnrollment,
  onInheritDatesChange,
  onInheritEnrollmentChange,
}: {
  fullProgramEnabled: boolean
  sessionRegistrationEnabled: boolean
  singleSessionEnabled: boolean
  onFullProgramChange: (enabled: boolean) => void
  onSessionRegistrationChange: (enabled: boolean) => void
  onSingleSessionChange: (enabled: boolean) => void
  enrollmentOpenDate: string
  enrollmentCloseDate: string
  onEnrollmentOpenDateChange: (value: string) => void
  onEnrollmentCloseDateChange: (value: string) => void
  registrationOpen: boolean
  enableWaitlist: boolean
  onEnableWaitlistChange: (enabled: boolean) => void
  inheritDates?: boolean
  inheritEnrollment?: boolean
  onInheritDatesChange?: (inherit: boolean) => void
  onInheritEnrollmentChange?: (inherit: boolean) => void
}) {
  const typeChecked: Record<EnrollmentTypeId, boolean> = {
    full_program: fullProgramEnabled,
    selected_sessions: sessionRegistrationEnabled,
    single_session: singleSessionEnabled,
  }

  const typeHandlers: Record<EnrollmentTypeId, (enabled: boolean) => void> = {
    full_program: onFullProgramChange,
    selected_sessions: onSessionRegistrationChange,
    single_session: onSingleSessionChange,
  }

  const datesLocked = Boolean(inheritDates)
  const enrollmentLocked = Boolean(inheritEnrollment)

  return (
    <EditSectionCard title="Enrollment Window & Type">
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        {onInheritDatesChange ? (
          <label className="flex items-center gap-2">
            <Switch
              checked={datesLocked}
              onCheckedChange={onInheritDatesChange}
            />
            <span className="text-muted-foreground">
              Use program dates
            </span>
          </label>
        ) : null}
        {onInheritEnrollmentChange ? (
          <label className="flex items-center gap-2">
            <Switch
              checked={enrollmentLocked}
              onCheckedChange={onInheritEnrollmentChange}
            />
            <span className="text-muted-foreground">
              Use program enrollment types &amp; waitlist
            </span>
          </label>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label>Enrollment Type</Label>
          <div
            className={cn(
              "space-y-2 rounded-md border bg-background px-3 py-2",
              enrollmentLocked && "opacity-60"
            )}
          >
            {ENROLLMENT_TYPE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={typeChecked[option.value]}
                  disabled={enrollmentLocked}
                  onChange={(event) => {
                    onInheritEnrollmentChange?.(false)
                    typeHandlers[option.value](event.target.checked)
                  }}
                  className="size-3.5 rounded border"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {enrollmentLocked
              ? "Inherited from program settings."
              : "Choose one or more ways customers can register."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="enrollment_open_date">Enrollment Opens</Label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="enrollment_open_date"
              type="date"
              className="h-9 bg-background pl-9"
              value={enrollmentOpenDate}
              disabled={datesLocked}
              onChange={(event) => {
                onInheritDatesChange?.(false)
                onEnrollmentOpenDateChange(event.target.value)
              }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="enrollment_close_date">Enrollment Closes</Label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="enrollment_close_date"
              type="date"
              className="h-9 bg-background pl-9"
              value={enrollmentCloseDate}
              disabled={datesLocked}
              onChange={(event) => {
                onInheritDatesChange?.(false)
                onEnrollmentCloseDateChange(event.target.value)
              }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Registration Status</Label>
          <div className="flex h-9 items-center">
            <Badge
              variant="secondary"
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                registrationOpen
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-zinc-100 text-zinc-600"
              )}
            >
              {registrationOpen ? "Open" : "Closed"}
            </Badge>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="enrollment-waitlist">Waitlist</Label>
          <div className="flex h-9 items-center gap-3">
            <Switch
              id="enrollment-waitlist"
              checked={enableWaitlist}
              disabled={enrollmentLocked}
              onCheckedChange={(checked) => {
                onInheritEnrollmentChange?.(false)
                onEnableWaitlistChange(checked)
              }}
            />
            <span className="text-sm text-muted-foreground">
              {enableWaitlist ? "On" : "Off"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Enable to allow waitlisted registrations.
          </p>
        </div>
      </div>
    </EditSectionCard>
  )
}

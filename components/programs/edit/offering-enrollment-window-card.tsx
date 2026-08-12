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
    label: "Day Pass",
  },
]

/** Waitlist / Attendance / Auto Register — title above, switch below, one row. */
export function OfferingEnrollmentOptionToggles({
  enableWaitlist,
  onEnableWaitlistChange,
  attendanceTracked = false,
  onAttendanceTrackedChange,
  openEnrollment = false,
  onOpenEnrollmentChange,
  disabled = false,
  /** Compact labels for Advanced Settings row. */
  compactLabels = false,
}: {
  enableWaitlist: boolean
  onEnableWaitlistChange: (enabled: boolean) => void
  attendanceTracked?: boolean
  onAttendanceTrackedChange?: (enabled: boolean) => void
  openEnrollment?: boolean
  onOpenEnrollmentChange?: (enabled: boolean) => void
  disabled?: boolean
  compactLabels?: boolean
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-3", disabled && "opacity-60")}>
      <div className="space-y-2">
        <Label htmlFor="enrollment-waitlist">Enable waitlist</Label>
        <div className="flex items-center gap-3">
          <Switch
            id="enrollment-waitlist"
            checked={enableWaitlist}
            disabled={disabled}
            onCheckedChange={onEnableWaitlistChange}
          />
          {!compactLabels ? (
            <span className="text-sm text-muted-foreground">
              {enableWaitlist ? "On" : "Off"}
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="enrollment-attendance">Attendance</Label>
        <div className="flex items-center gap-3">
          <Switch
            id="enrollment-attendance"
            checked={attendanceTracked}
            disabled={disabled}
            onCheckedChange={(checked) => {
              onAttendanceTrackedChange?.(checked)
            }}
          />
          {!compactLabels ? (
            <span className="text-sm text-muted-foreground">
              {attendanceTracked ? "Track attendance" : "Off"}
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="enrollment-open-path">
          {compactLabels ? "Auto Register" : "Automatically register and pay"}
        </Label>
        <div className="flex items-center gap-3">
          <Switch
            id="enrollment-open-path"
            checked={openEnrollment}
            disabled={disabled}
            onCheckedChange={(checked) => {
              onOpenEnrollmentChange?.(checked)
            }}
          />
          {!compactLabels ? (
            <span className="text-sm text-muted-foreground">
              {openEnrollment
                ? "No approval — customers register and pay"
                : "Require Apply / Approve first"}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

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
  openEnrollment = false,
  onOpenEnrollmentChange,
  attendanceTracked = false,
  onAttendanceTrackedChange,
  disabled = false,
  plain = false,
  /** Hide dates / auto-register when those live on the parent edit form. */
  hideBasicFields = false,
  /** When false, parent renders toggles elsewhere (e.g. under Sessions). */
  showOptionToggles = true,
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
  /** When true, customers Register & pay with no Apply/Approve step. */
  openEnrollment?: boolean
  onOpenEnrollmentChange?: (enabled: boolean) => void
  attendanceTracked?: boolean
  onAttendanceTrackedChange?: (enabled: boolean) => void
  disabled?: boolean
  plain?: boolean
  hideBasicFields?: boolean
  showOptionToggles?: boolean
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

  const enrollmentModel = (
    <div className="space-y-1.5">
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-5 gap-y-2",
          !plain && "rounded-md border bg-background px-3 py-2",
          disabled && "opacity-60"
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
              disabled={disabled}
              onChange={(event) =>
                typeHandlers[option.value](event.target.checked)
              }
              className="size-3.5 rounded border"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {!plain ? (
        <p className="text-xs text-muted-foreground">
          Choose one or more ways customers can register.
        </p>
      ) : null}
    </div>
  )

  const optionToggles = showOptionToggles ? (
    <OfferingEnrollmentOptionToggles
      enableWaitlist={enableWaitlist}
      onEnableWaitlistChange={onEnableWaitlistChange}
      attendanceTracked={attendanceTracked}
      onAttendanceTrackedChange={onAttendanceTrackedChange}
      openEnrollment={openEnrollment}
      onOpenEnrollmentChange={onOpenEnrollmentChange}
      disabled={disabled}
    />
  ) : null

  if (plain) {
    return (
      <EditSectionCard plain>
        <div className={cn("space-y-3", disabled && "opacity-60")}>
          {!hideBasicFields ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="enrollment_open_date">Enrollment Opens</Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="enrollment_open_date"
                    type="date"
                    className="h-9 bg-background pl-9"
                    value={enrollmentOpenDate}
                    disabled={disabled}
                    onChange={(event) =>
                      onEnrollmentOpenDateChange(event.target.value)
                    }
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
                    disabled={disabled}
                    onChange={(event) =>
                      onEnrollmentCloseDateChange(event.target.value)
                    }
                  />
                </div>
              </div>
            </>
          ) : null}

          {enrollmentModel}
          {optionToggles}
        </div>
      </EditSectionCard>
    )
  }

  return (
    <EditSectionCard title="Enrollment Window & Type">
      <div className="grid gap-4 lg:grid-cols-5">
        {!hideBasicFields ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="enrollment_open_date">Enrollment Opens</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="enrollment_open_date"
                  type="date"
                  className="h-9 bg-background pl-9"
                  value={enrollmentOpenDate}
                  disabled={disabled}
                  onChange={(event) => onEnrollmentOpenDateChange(event.target.value)}
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
                  disabled={disabled}
                  onChange={(event) =>
                    onEnrollmentCloseDateChange(event.target.value)
                  }
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
          </>
        ) : null}

        {enrollmentModel}
        {optionToggles ? (
          <div className="lg:col-span-5">{optionToggles}</div>
        ) : null}
      </div>
    </EditSectionCard>
  )
}

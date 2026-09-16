"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { EligibilitySection } from "@/components/programs/edit/eligibility-section"
import type { ProgramGender } from "@/components/programs/edit/types"
import { EditSectionCard } from "@/components/programs/edit/edit-section-card"
import { getInitialGradeLevels } from "@/components/programs/edit/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { saveProgramEnrollmentDefaults } from "@/lib/programs/program-detail-actions"
import {
  ENROLLMENT_PROCESS_OPTIONS,
  SEAT_ACTIVATION_OPTIONS,
  normalizeEnrollmentProcess,
  normalizeSeatActivationRule,
  type EnrollmentProcess,
  type SeatActivationRule,
} from "@/lib/programs/enrollment-process"
import { parseProgramAgeBounds } from "@/lib/programs/program-eligibility-display"
import type { ProgramAudienceType } from "@/lib/programs/program-offering-attributes"
import type { Program } from "@/lib/programs/program-types"
import { useRouter } from "next/navigation"

type ProgramDefaultsSource = Program & {
  full_program_registration_enabled?: boolean
  session_registration_enabled?: boolean
  single_session_registration_enabled?: boolean
}

const ENROLLMENT_TYPE_OPTIONS = [
  {
    id: "full_program" as const,
    label: "Entire Program",
    description: "Customers register for the entire program.",
  },
  {
    id: "selected_sessions" as const,
    label: "Selected Sessions",
    description: "Customers choose one or more sessions.",
  },
  {
    id: "single_session" as const,
    label: "Single Session",
    description: "Customers register for one session only.",
  },
]

/**
 * F2: Program-level enrollment defaults (dates, eligibility, types, waitlist).
 * Programs inherit these unless customized.
 */
export function ProgramDefaultsSettingsPanel({
  program,
  hideDates = false,
  hideIntro = false,
}: {
  program: ProgramDefaultsSource
  /** When dates already appear on the same Settings page. */
  hideDates?: boolean
  hideIntro?: boolean
}) {
  const router = useRouter()
  const ageBounds = React.useMemo(
    () => parseProgramAgeBounds(program),
    [program]
  )

  const [startDate, setStartDate] = React.useState(program.start_date ?? "")
  const [endDate, setEndDate] = React.useState(program.end_date ?? "")
  const [enrollmentOpenDate, setEnrollmentOpenDate] = React.useState(
    program.enrollment_open_date ?? ""
  )
  const [enrollmentCloseDate, setEnrollmentCloseDate] = React.useState(
    program.enrollment_close_date ?? ""
  )
  const [audienceType, setAudienceType] = React.useState<ProgramAudienceType>(
    program.program_type === "adult" ? "adult" : "youth"
  )
  const [minAge, setMinAge] = React.useState<number | null>(ageBounds.minAge)
  const [maxAge, setMaxAge] = React.useState<number | null>(ageBounds.maxAge)
  const [gradeLevels, setGradeLevels] = React.useState(() =>
    getInitialGradeLevels(program)
  )
  const [programGender, setProgramGender] = React.useState<ProgramGender>(
    (program.gender as ProgramGender) || "All"
  )
  const [fullProgramEnabled, setFullProgramEnabled] = React.useState(
    program.full_program_registration_enabled ?? true
  )
  const [sessionRegistrationEnabled, setSessionRegistrationEnabled] =
    React.useState(program.session_registration_enabled ?? false)
  const [singleSessionEnabled, setSingleSessionEnabled] = React.useState(
    program.single_session_registration_enabled ?? false
  )
  const [enableWaitlist, setEnableWaitlist] = React.useState(
    program.enable_waitlist ?? false
  )
  const [waitlistCapacity, setWaitlistCapacity] = React.useState(
    program.waitlist_capacity?.toString() ?? ""
  )
  const [enrollmentProcess, setEnrollmentProcess] =
    React.useState<EnrollmentProcess>(() =>
      normalizeEnrollmentProcess(
        program.enrollment_process,
        program.program_kind
      )
    )
  const [evaluationRequired, setEvaluationRequired] = React.useState(
    Boolean(program.evaluation_required)
  )
  const [seatActivationRule, setSeatActivationRule] =
    React.useState<SeatActivationRule>(() =>
      normalizeSeatActivationRule(program.seat_activation_rule)
    )
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  React.useEffect(() => {
    const nextBounds = parseProgramAgeBounds(program)
    setStartDate(program.start_date ?? "")
    setEndDate(program.end_date ?? "")
    setEnrollmentOpenDate(program.enrollment_open_date ?? "")
    setEnrollmentCloseDate(program.enrollment_close_date ?? "")
    setAudienceType(program.program_type === "adult" ? "adult" : "youth")
    setMinAge(nextBounds.minAge)
    setMaxAge(nextBounds.maxAge)
    setGradeLevels(getInitialGradeLevels(program))
    setProgramGender((program.gender as ProgramGender) || "All")
    setFullProgramEnabled(program.full_program_registration_enabled ?? true)
    setSessionRegistrationEnabled(program.session_registration_enabled ?? false)
    setSingleSessionEnabled(
      program.single_session_registration_enabled ?? false
    )
    setEnableWaitlist(program.enable_waitlist ?? false)
    setWaitlistCapacity(program.waitlist_capacity?.toString() ?? "")
    setEnrollmentProcess(
      normalizeEnrollmentProcess(
        program.enrollment_process,
        program.program_kind
      )
    )
    setEvaluationRequired(Boolean(program.evaluation_required))
    setSeatActivationRule(
      normalizeSeatActivationRule(program.seat_activation_rule)
    )
  }, [program])

  React.useEffect(() => {
    if (audienceType === "adult") {
      setGradeLevels([])
      if (minAge == null || minAge < 18) setMinAge(18)
    }
  }, [audienceType, minAge])

  const typeChecked = {
    full_program: fullProgramEnabled,
    selected_sessions: sessionRegistrationEnabled,
    single_session: singleSessionEnabled,
  }
  const typeHandlers = {
    full_program: setFullProgramEnabled,
    selected_sessions: setSessionRegistrationEnabled,
    single_session: setSingleSessionEnabled,
  }

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    setSuccess(false)

    const result = await saveProgramEnrollmentDefaults({
      programId: program.id,
      ...(hideDates
        ? {}
        : {
            start_date: startDate || null,
            end_date: endDate || null,
            enrollment_open_date: enrollmentOpenDate || null,
            enrollment_close_date: enrollmentCloseDate || null,
          }),
      program_type: audienceType,
      min_age: minAge,
      max_age: maxAge,
      grade_levels: gradeLevels,
      gender: programGender,
      full_program_registration_enabled: fullProgramEnabled,
      session_registration_enabled: sessionRegistrationEnabled,
      single_session_registration_enabled: singleSessionEnabled,
      enable_waitlist: enableWaitlist,
      waitlist_capacity:
        waitlistCapacity.trim() === "" ? null : Number(waitlistCapacity),
      enrollment_process: enrollmentProcess,
      evaluation_required:
        enrollmentProcess === "application_approval"
          ? evaluationRequired
          : false,
      seat_activation_rule: seatActivationRule,
    })

    setIsSaving(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    setSuccess(true)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {hideIntro ? null : (
      <div className="rounded-lg border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-sky-950">
        Set these once for the program. New offerings inherit them.
        Existing offerings keep their own values unless they still have inherit
        turned on.
      </div>
      )}

      <EditSectionCard
        title="Enrollment process"
        description="One registration engine. Application and approval are optional."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            {ENROLLMENT_PROCESS_OPTIONS.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2"
              >
                <input
                  type="radio"
                  name="enrollment-process"
                  className="mt-1 size-3.5"
                  checked={enrollmentProcess === option.id}
                  onChange={() => setEnrollmentProcess(option.id)}
                />
                <span>
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {enrollmentProcess === "application_approval" ? (
            <div className="flex flex-wrap items-end gap-6 border-t pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="defaults-evaluation">Evaluation required</Label>
                <div className="flex h-9 items-center gap-3">
                  <Switch
                    id="defaults-evaluation"
                    checked={evaluationRequired}
                    onCheckedChange={setEvaluationRequired}
                  />
                  <span className="text-sm text-muted-foreground">
                    {evaluationRequired ? "Yes" : "No"}
                  </span>
                </div>
                <p className="max-w-xl text-xs text-muted-foreground">
                  When enabled, applicants must complete an evaluation before
                  approval.
                </p>
              </div>
            </div>
          ) : null}

          <div className="space-y-2 border-t pt-4">
            <Label>When should the participant’s seat become active?</Label>
            {SEAT_ACTIVATION_OPTIONS.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2"
              >
                <input
                  type="radio"
                  name="seat-activation"
                  className="mt-1 size-3.5"
                  checked={seatActivationRule === option.id}
                  onChange={() => setSeatActivationRule(option.id)}
                />
                <span>
                  <span className="block text-sm font-medium">
                    {option.label}
                    {option.recommended ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        Recommended
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </EditSectionCard>

      {hideDates ? null : (
      <EditSectionCard
        title="Program dates & enrollment window"
        description="Default term and registration window for offerings that inherit dates."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="defaults-start">Start date</Label>
            <Input
              id="defaults-start"
              type="date"
              className="h-9"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="defaults-end">End date</Label>
            <Input
              id="defaults-end"
              type="date"
              className="h-9"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="defaults-enroll-open">Enrollment opens</Label>
            <Input
              id="defaults-enroll-open"
              type="date"
              className="h-9"
              value={enrollmentOpenDate}
              onChange={(event) => setEnrollmentOpenDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="defaults-enroll-close">Enrollment closes</Label>
            <Input
              id="defaults-enroll-close"
              type="date"
              className="h-9"
              value={enrollmentCloseDate}
              onChange={(event) => setEnrollmentCloseDate(event.target.value)}
            />
          </div>
        </div>
      </EditSectionCard>
      )}

      <EditSectionCard
        title="Audience"
        description="Adult vs youth default for inheriting programs."
      >
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="defaults-audience">Audience</Label>
          <select
            id="defaults-audience"
            value={audienceType}
            onChange={(event) =>
              setAudienceType(event.target.value as ProgramAudienceType)
            }
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="adult">Adults</option>
            <option value="youth">Youth</option>
          </select>
        </div>
      </EditSectionCard>

      <EligibilitySection
        minAge={minAge}
        maxAge={maxAge}
        onMinAgeChange={setMinAge}
        onMaxAgeChange={setMaxAge}
        gradeLevels={gradeLevels}
        onGradeLevelsChange={setGradeLevels}
        programGender={programGender}
        onProgramGenderChange={setProgramGender}
      />

      <EditSectionCard
        title="Enrollment types"
        description="Default registration types for programs that inherit enrollment settings."
      >
        <div className="space-y-2">
          {ENROLLMENT_TYPE_OPTIONS.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2"
            >
              <input
                type="checkbox"
                className="mt-1 size-3.5"
                checked={typeChecked[option.id]}
                onChange={(event) =>
                  typeHandlers[option.id](event.target.checked)
                }
              />
              <span>
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </EditSectionCard>

      <EditSectionCard
        title="Waitlist"
        description="Default waitlist policy for inheriting programs."
      >
        <div className="flex flex-wrap items-end gap-6">
          <div className="space-y-1.5">
            <Label htmlFor="defaults-waitlist">Waitlist</Label>
            <div className="flex h-9 items-center gap-3">
              <Switch
                id="defaults-waitlist"
                checked={enableWaitlist}
                onCheckedChange={setEnableWaitlist}
              />
              <span className="text-sm text-muted-foreground">
                {enableWaitlist ? "On" : "Off"}
              </span>
            </div>
          </div>
          {enableWaitlist ? (
            <div className="space-y-1.5">
              <Label htmlFor="defaults-waitlist-cap">Waitlist capacity</Label>
              <Input
                id="defaults-waitlist-cap"
                type="number"
                min="0"
                className="h-9 w-40"
                value={waitlistCapacity}
                onChange={(event) => setWaitlistCapacity(event.target.value)}
                placeholder="Optional"
              />
            </div>
          ) : null}
        </div>
      </EditSectionCard>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Defaults saved. Programs that still inherit these settings were
          updated.
        </p>
      ) : null}

      <div className="flex justify-end border-t pt-4">
        <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save enrollment settings"
          )}
        </Button>
      </div>
    </div>
  )
}

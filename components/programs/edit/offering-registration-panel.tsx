"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { EligibilitySection } from "@/components/programs/edit/eligibility-section"
import { EnrollmentSettingsSection } from "@/components/programs/edit/enrollment-settings-section"
import { EditSectionCard } from "@/components/programs/edit/edit-section-card"
import {
  OfferingRegistrationCapacitySection,
  type OfferingRegistrationCapacitySectionHandle,
} from "@/components/programs/edit/offering-registration-capacity-section"
import {
  getInitialGradeLevels,
  gradesApplyForMinAge,
} from "@/components/programs/edit/utils"
import type { ProgramGender } from "@/components/programs/edit/types"
import { Button } from "@/components/ui/button"
import { saveOfferingRegistrationPanel } from "@/lib/programs/offering-workspace-actions"
import { parseProgramAgeBounds } from "@/lib/programs/program-eligibility-display"
import type { ProgramCapacityGroupInput } from "@/lib/programs/program-capacity-group-types"
import { normalizeCapacityGroups } from "@/lib/programs/program-capacity-group-utils"
import type { OfferingWorkspaceData } from "@/lib/programs/offering-workspace-types"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import {
  getRegistrationOptionsSignature,
  isRegistrationOptionActive,
  type ProgramRegistrationOption,
} from "@/lib/programs/program-registration-option-types"
import type { Program } from "@/lib/programs/program-types"

const REGISTRATION_OPTION_ITEMS = [
  {
    id: "full_program" as const,
    label: "Full Program Registration",
    description:
      "Customers register once for the entire offering (camp, season, or fixed course).",
  },
  {
    id: "selected_sessions" as const,
    label: "Session-Based Registration",
    description:
      "Customers select one or more sessions under this offering.",
  },
  {
    id: "single_session" as const,
    label: "Single Session",
    description: "Register for a single session only.",
  },
  {
    id: "drop_in" as const,
    label: "Drop-In",
    description: "Drop in for an individual session without a full commitment.",
  },
] as const

/** Registration form source: offering SSOT with program defaults as fallback (S6). */
function getOfferingRegistrationSource(
  offering: ProgramOffering,
  program: Program
) {
  return {
    min_age: offering.min_age ?? program.min_age ?? null,
    max_age: offering.max_age ?? program.max_age ?? null,
    min_grade: offering.min_grade ?? program.min_grade ?? null,
    max_grade: offering.max_grade ?? program.max_grade ?? null,
    grade_levels:
      offering.grade_levels?.length > 0
        ? offering.grade_levels
        : program.grade_levels ?? [],
    gender: offering.gender ?? program.gender ?? "All",
    enrollment_open_date:
      offering.enrollment_open_date ?? program.enrollment_open_date ?? null,
    enrollment_close_date:
      offering.enrollment_close_date ?? program.enrollment_close_date ?? null,
    capacity:
      offering.capacity_mode === "limited"
        ? Math.max(0, Number(offering.capacity || 0))
        : 0,
    enable_waitlist: offering.enable_waitlist ?? false,
    waitlist_capacity: offering.waitlist_capacity ?? null,
  }
}

function syncRegistrationTypeState(
  options: OfferingWorkspaceData["registrationOptions"],
  setters: {
    setFullProgramEnabled: (value: boolean) => void
    setSessionRegistrationEnabled: (value: boolean) => void
    setSingleSessionEnabled: (value: boolean) => void
    setDropInEnabled: (value: boolean) => void
  }
) {
  setters.setFullProgramEnabled(
    isRegistrationOptionActive(options, "full_program")
  )
  setters.setSessionRegistrationEnabled(
    isRegistrationOptionActive(options, "selected_sessions")
  )
  setters.setSingleSessionEnabled(
    isRegistrationOptionActive(options, "single_session")
  )
  setters.setDropInEnabled(isRegistrationOptionActive(options, "drop_in"))
}

export function OfferingRegistrationPanel({
  program,
  offering,
  workspaceData,
  capacityGroups,
  onCapacityGroupsChange,
  onRegistrationOptionsSaved,
  onNavigateNext,
  enrolled,
}: {
  program: Program
  offering: ProgramOffering
  workspaceData: OfferingWorkspaceData
  capacityGroups: ProgramCapacityGroupInput[]
  onCapacityGroupsChange: (groups: ProgramCapacityGroupInput[]) => void
  onRegistrationOptionsSaved?: (
    offeringId: string,
    registrationOptions: ProgramRegistrationOption[]
  ) => void
  onNavigateNext?: () => void
  enrolled?: number
}) {
  const router = useRouter()
  const capacitySectionRef =
    React.useRef<OfferingRegistrationCapacitySectionHandle>(null)
  const source = React.useMemo(
    () => getOfferingRegistrationSource(offering, program),
    [offering, program]
  )
  const initialAgeBounds = React.useMemo(
    () => parseProgramAgeBounds(source),
    [source]
  )

  const [minAge, setMinAge] = React.useState<number | null>(initialAgeBounds.minAge)
  const [maxAge, setMaxAge] = React.useState<number | null>(initialAgeBounds.maxAge)
  const [gradeLevels, setGradeLevels] = React.useState<string[]>(() =>
    getInitialGradeLevels(source)
  )
  const [programGender, setProgramGender] = React.useState<ProgramGender>(
    (source.gender as ProgramGender) || "All"
  )
  const [enrollmentOpenDate, setEnrollmentOpenDate] = React.useState(
    source.enrollment_open_date ?? ""
  )
  const [enrollmentCloseDate, setEnrollmentCloseDate] = React.useState(
    source.enrollment_close_date ?? ""
  )
  const [fullProgramEnabled, setFullProgramEnabled] = React.useState(() =>
    isRegistrationOptionActive(workspaceData.registrationOptions, "full_program")
  )
  const [sessionRegistrationEnabled, setSessionRegistrationEnabled] =
    React.useState(() =>
      isRegistrationOptionActive(
        workspaceData.registrationOptions,
        "selected_sessions"
      )
    )
  const [singleSessionEnabled, setSingleSessionEnabled] = React.useState(() =>
    isRegistrationOptionActive(
      workspaceData.registrationOptions,
      "single_session"
    )
  )
  const [dropInEnabled, setDropInEnabled] = React.useState(() =>
    isRegistrationOptionActive(workspaceData.registrationOptions, "drop_in")
  )
  const [capacity, setCapacity] = React.useState(source.capacity)
  const [enableWaitlist, setEnableWaitlist] = React.useState(
    source.enable_waitlist
  )
  const [waitlistCapacity, setWaitlistCapacity] = React.useState(
    source.waitlist_capacity?.toString() ?? ""
  )
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  React.useEffect(() => {
    const ageBounds = parseProgramAgeBounds(source)
    setMinAge(ageBounds.minAge)
    setMaxAge(ageBounds.maxAge)
    setGradeLevels(getInitialGradeLevels(source))
    setProgramGender((source.gender as ProgramGender) || "All")
    setEnrollmentOpenDate(source.enrollment_open_date ?? "")
    setEnrollmentCloseDate(source.enrollment_close_date ?? "")
    setCapacity(source.capacity)
    setEnableWaitlist(source.enable_waitlist)
    setWaitlistCapacity(source.waitlist_capacity?.toString() ?? "")
  }, [source])

  const registrationOptionsSignature = React.useMemo(
    () => getRegistrationOptionsSignature(workspaceData.registrationOptions),
    [workspaceData.registrationOptions]
  )

  React.useEffect(() => {
    syncRegistrationTypeState(workspaceData.registrationOptions, {
      setFullProgramEnabled,
      setSessionRegistrationEnabled,
      setSingleSessionEnabled,
      setDropInEnabled,
    })
  }, [offering.id, registrationOptionsSignature])

  React.useEffect(() => {
    if (!gradesApplyForMinAge(minAge)) {
      setGradeLevels([])
    }
  }, [minAge])

  const normalizedCapacityGroups = React.useMemo(
    () => normalizeCapacityGroups(capacityGroups, gradeLevels),
    [capacityGroups, gradeLevels]
  )

  async function handleNext() {
    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const flushedCapacityGroups =
        capacitySectionRef.current?.flushCapacityGroups() ?? normalizedCapacityGroups

      const registrationOptions = await saveOfferingRegistrationPanel({
        programId: program.id,
        offeringId: offering.id,
        organizationId: program.organization_id,
        min_age: minAge,
        max_age: maxAge,
        grade_levels: gradeLevels,
        gender: programGender,
        enrollment_open_date: enrollmentOpenDate || null,
        enrollment_close_date: enrollmentCloseDate || null,
        fullProgramEnabled,
        sessionRegistrationEnabled,
        singleSessionEnabled,
        dropInEnabled,
        capacity,
        capacityGroups: flushedCapacityGroups,
        enable_waitlist: enableWaitlist,
        waitlist_capacity:
          waitlistCapacity.trim() === "" ? null : Number(waitlistCapacity),
      })
      onRegistrationOptionsSaved?.(offering.id, registrationOptions)
      onCapacityGroupsChange(flushedCapacityGroups)
      setSuccess(true)
      router.refresh()
      onNavigateNext?.()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save registration settings."
      )
    } finally {
      setIsSaving(false)
    }
  }

  const checkboxState = {
    full_program: fullProgramEnabled,
    selected_sessions: sessionRegistrationEnabled,
    single_session: singleSessionEnabled,
    drop_in: dropInEnabled,
  }

  const checkboxHandlers = {
    full_program: setFullProgramEnabled,
    selected_sessions: setSessionRegistrationEnabled,
    single_session: setSingleSessionEnabled,
    drop_in: setDropInEnabled,
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <EnrollmentSettingsSection
            enrollmentOpenDate={enrollmentOpenDate}
            enrollmentCloseDate={enrollmentCloseDate}
            onEnrollmentOpenDateChange={setEnrollmentOpenDate}
            onEnrollmentCloseDateChange={setEnrollmentCloseDate}
            description="Enrollment window for this offering."
          />

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

        </div>

        <EditSectionCard
          title="Registration types"
          description="Choose how customers can register for this offering."
        >
          <div className="space-y-3">
            {REGISTRATION_OPTION_ITEMS.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
              >
                <input
                  type="checkbox"
                  checked={checkboxState[item.id]}
                  onChange={(event) =>
                    checkboxHandlers[item.id](event.target.checked)
                  }
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </EditSectionCard>
      </div>

      <OfferingRegistrationCapacitySection
        ref={capacitySectionRef}
        program={program}
        fullProgramEnabled={fullProgramEnabled}
        sessionRegistrationEnabled={sessionRegistrationEnabled}
        minAge={minAge}
        gradeLevels={gradeLevels}
        programGender={programGender}
        capacity={capacity}
        onCapacityChange={setCapacity}
        capacityGroups={normalizedCapacityGroups}
        onCapacityGroupsChange={onCapacityGroupsChange}
        enableWaitlist={enableWaitlist}
        onEnableWaitlistChange={setEnableWaitlist}
        waitlistCapacity={waitlistCapacity}
        onWaitlistCapacityChange={setWaitlistCapacity}
        enrolled={enrolled}
      />

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Registration settings saved for {offering.name}.
        </p>
      ) : null}

      <div className="flex justify-end border-t pt-4">
        <Button type="button" onClick={() => void handleNext()} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Next"
          )}
        </Button>
      </div>
    </div>
  )
}

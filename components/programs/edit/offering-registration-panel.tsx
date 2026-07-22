"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import {
  OfferingEligibilityCard,
} from "@/components/programs/edit/offering-eligibility-card"
import {
  OfferingEnrollmentWindowCard,
} from "@/components/programs/edit/offering-enrollment-window-card"
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
import type { OfferingAudienceType } from "@/lib/programs/program-offering-attributes"
import {
  readOfferingInheritFlags,
  resolveEffectiveOfferingRegistrationSource,
} from "@/lib/programs/program-offering-inherit"
import { isOfferingEnrollmentOpen } from "@/lib/programs/program-offering-display"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import {
  getRegistrationOptionsSignature,
  isRegistrationOptionActive,
  type ProgramRegistrationOption,
} from "@/lib/programs/program-registration-option-types"
import type { Program } from "@/lib/programs/program-types"

/** Registration form source: effective offering values with program inherit (F1). */
function getOfferingRegistrationSource(
  offering: ProgramOffering,
  program: Program
) {
  const effective = resolveEffectiveOfferingRegistrationSource(offering, program)

  return {
    min_age: effective.min_age,
    max_age: effective.max_age,
    min_grade: effective.min_grade,
    max_grade: effective.max_grade,
    grade_levels: effective.grade_levels,
    gender: effective.gender ?? "All",
    audience_type: effective.audience_type,
    enrollment_open_date: effective.enrollment_open_date,
    enrollment_close_date: effective.enrollment_close_date,
    capacity:
      offering.capacity_mode === "limited"
        ? Math.max(0, Number(offering.capacity || 0))
        : 0,
    enable_waitlist: effective.enable_waitlist,
    waitlist_capacity: effective.waitlist_capacity,
    inherit_dates: effective.inherit_dates,
    inherit_eligibility: effective.inherit_eligibility,
    inherit_enrollment: effective.inherit_enrollment,
  }
}

function syncEnrollmentTypes(
  options: OfferingWorkspaceData["registrationOptions"],
  setters: {
    setFullProgramEnabled: (value: boolean) => void
    setSessionRegistrationEnabled: (value: boolean) => void
    setSingleSessionEnabled: (value: boolean) => void
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
}

export function OfferingRegistrationPanel({
  program,
  offering,
  workspaceData,
  capacityGroups,
  onCapacityGroupsChange,
  onRegistrationOptionsSaved,
  enrolled,
  showSaveButton = true,
  saveHandlerRef,
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
  enrolled?: number
  /** When false, parent provides a shared Save (e.g. offering manage Enrollment). */
  showSaveButton?: boolean
  saveHandlerRef?: React.MutableRefObject<(() => Promise<boolean>) | null>
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
  const [audienceType, setAudienceType] = React.useState<OfferingAudienceType>(
    source.audience_type
  )
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
  const [capacity, setCapacity] = React.useState(source.capacity)
  const [enableWaitlist, setEnableWaitlist] = React.useState(
    source.enable_waitlist
  )
  const [waitlistCapacity, setWaitlistCapacity] = React.useState(
    source.waitlist_capacity?.toString() ?? ""
  )
  const initialInherit = readOfferingInheritFlags(offering)
  const [inheritDates, setInheritDates] = React.useState(
    initialInherit.inherit_dates
  )
  const [inheritEligibility, setInheritEligibility] = React.useState(
    initialInherit.inherit_eligibility
  )
  const [inheritEnrollment, setInheritEnrollment] = React.useState(
    initialInherit.inherit_enrollment
  )
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  const registrationOpen = isOfferingEnrollmentOpen({
    enrollment_open_date: enrollmentOpenDate || null,
    enrollment_close_date: enrollmentCloseDate || null,
  })

  React.useEffect(() => {
    const ageBounds = parseProgramAgeBounds(source)
    setMinAge(ageBounds.minAge)
    setMaxAge(ageBounds.maxAge)
    setAudienceType(source.audience_type)
    setGradeLevels(getInitialGradeLevels(source))
    setProgramGender((source.gender as ProgramGender) || "All")
    setEnrollmentOpenDate(source.enrollment_open_date ?? "")
    setEnrollmentCloseDate(source.enrollment_close_date ?? "")
    setCapacity(source.capacity)
    setEnableWaitlist(source.enable_waitlist)
    setWaitlistCapacity(source.waitlist_capacity?.toString() ?? "")
    const flags = readOfferingInheritFlags(offering)
    setInheritDates(flags.inherit_dates)
    setInheritEligibility(flags.inherit_eligibility)
    setInheritEnrollment(flags.inherit_enrollment)
  }, [source, offering])

  function applyProgramDates() {
    setEnrollmentOpenDate(program.enrollment_open_date ?? "")
    setEnrollmentCloseDate(program.enrollment_close_date ?? "")
  }

  function applyProgramEligibility() {
    const effective = resolveEffectiveOfferingRegistrationSource(
      { ...offering, inherit_eligibility: true },
      program
    )
    setAudienceType(effective.audience_type)
    setMinAge(effective.min_age)
    setMaxAge(effective.max_age)
    setGradeLevels(effective.grade_levels)
    setProgramGender((effective.gender as ProgramGender) || "All")
  }

  function applyProgramEnrollment() {
    const prog = program as Program & {
      full_program_registration_enabled?: boolean
      session_registration_enabled?: boolean
      single_session_registration_enabled?: boolean
    }
    setFullProgramEnabled(prog.full_program_registration_enabled ?? true)
    setSessionRegistrationEnabled(prog.session_registration_enabled ?? false)
    setSingleSessionEnabled(prog.single_session_registration_enabled ?? false)
    setEnableWaitlist(prog.enable_waitlist ?? false)
    setWaitlistCapacity(prog.waitlist_capacity?.toString() ?? "")
  }

  function handleInheritDatesChange(inherit: boolean) {
    setInheritDates(inherit)
    if (inherit) applyProgramDates()
  }

  function handleInheritEligibilityChange(inherit: boolean) {
    setInheritEligibility(inherit)
    if (inherit) applyProgramEligibility()
  }

  function handleInheritEnrollmentChange(inherit: boolean) {
    setInheritEnrollment(inherit)
    if (inherit) applyProgramEnrollment()
  }

  const registrationOptionsSignature = React.useMemo(
    () => getRegistrationOptionsSignature(workspaceData.registrationOptions),
    [workspaceData.registrationOptions]
  )

  React.useEffect(() => {
    syncEnrollmentTypes(workspaceData.registrationOptions, {
      setFullProgramEnabled,
      setSessionRegistrationEnabled,
      setSingleSessionEnabled,
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

  async function handleSave(): Promise<boolean> {
    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const flushedCapacityGroups =
        capacitySectionRef.current?.flushCapacityGroups() ??
        normalizedCapacityGroups

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
        dropInEnabled: false,
        capacity,
        capacityGroups: flushedCapacityGroups,
        enable_waitlist: enableWaitlist,
        waitlist_capacity:
          waitlistCapacity.trim() === "" ? null : Number(waitlistCapacity),
        inherit_dates: inheritDates,
        inherit_eligibility: inheritEligibility,
        inherit_enrollment: inheritEnrollment,
      })
      onRegistrationOptionsSaved?.(offering.id, registrationOptions)
      onCapacityGroupsChange(flushedCapacityGroups)
      setSuccess(true)
      router.refresh()
      return true
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save registration settings."
      )
      return false
    } finally {
      setIsSaving(false)
    }
  }

  React.useEffect(() => {
    if (!saveHandlerRef) return
    saveHandlerRef.current = () => handleSave()
    return () => {
      saveHandlerRef.current = null
    }
  })

  return (
    <div className="space-y-4">
      <OfferingEnrollmentWindowCard
        fullProgramEnabled={fullProgramEnabled}
        sessionRegistrationEnabled={sessionRegistrationEnabled}
        singleSessionEnabled={singleSessionEnabled}
        onFullProgramChange={setFullProgramEnabled}
        onSessionRegistrationChange={setSessionRegistrationEnabled}
        onSingleSessionChange={setSingleSessionEnabled}
        enrollmentOpenDate={enrollmentOpenDate}
        enrollmentCloseDate={enrollmentCloseDate}
        onEnrollmentOpenDateChange={setEnrollmentOpenDate}
        onEnrollmentCloseDateChange={setEnrollmentCloseDate}
        registrationOpen={registrationOpen}
        enableWaitlist={enableWaitlist}
        onEnableWaitlistChange={setEnableWaitlist}
        inheritDates={inheritDates}
        inheritEnrollment={inheritEnrollment}
        onInheritDatesChange={handleInheritDatesChange}
        onInheritEnrollmentChange={handleInheritEnrollmentChange}
      />

      <OfferingEligibilityCard
        audienceType={audienceType}
        onAudienceTypeChange={setAudienceType}
        minAge={minAge}
        maxAge={maxAge}
        onMinAgeChange={setMinAge}
        onMaxAgeChange={setMaxAge}
        gradeLevels={gradeLevels}
        onGradeLevelsChange={setGradeLevels}
        programGender={programGender}
        onProgramGenderChange={setProgramGender}
        inheritEligibility={inheritEligibility}
        onInheritEligibilityChange={handleInheritEligibilityChange}
      />

      <OfferingRegistrationCapacitySection
        ref={capacitySectionRef}
        program={program}
        fullProgramEnabled={fullProgramEnabled}
        sessionRegistrationEnabled={
          sessionRegistrationEnabled || singleSessionEnabled
        }
        minAge={minAge}
        gradeLevels={gradeLevels}
        programGender={programGender}
        capacity={capacity}
        onCapacityChange={setCapacity}
        capacityGroups={normalizedCapacityGroups}
        onCapacityGroupsChange={onCapacityGroupsChange}
        enableWaitlist={enableWaitlist}
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

      {showSaveButton ? (
        <div className="flex justify-end border-t pt-4">
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

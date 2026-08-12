"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import {
  OfferingEligibilityCard,
} from "@/components/programs/edit/offering-eligibility-card"
import {
  OfferingEnrollmentOptionToggles,
  OfferingEnrollmentWindowCard,
} from "@/components/programs/edit/offering-enrollment-window-card"
import {
  OfferingRegistrationCapacitySection,
  type OfferingRegistrationCapacitySectionHandle,
} from "@/components/programs/edit/offering-registration-capacity-section"
import { OfferingRegistrationQuestionsEditor } from "@/components/programs/edit/offering-registration-questions-editor"
import { OfferingSettingsAccordionItem } from "@/components/programs/edit/offering-settings-section"
import {
  getInitialGradeLevels,
  gradesApplyForMinAge,
} from "@/components/programs/edit/utils"
import type { ProgramGender } from "@/components/programs/edit/types"
import { ProgramSessionsEditor } from "@/components/programs/program-sessions-editor"
import { Button } from "@/components/ui/button"
import { saveOfferingRegistrationPanel } from "@/lib/programs/offering-workspace-actions"
import { parseProgramAgeBounds } from "@/lib/programs/program-eligibility-display"
import type { ProgramCapacityGroupInput } from "@/lib/programs/program-capacity-group-types"
import { normalizeCapacityGroups } from "@/lib/programs/program-capacity-group-utils"
import type { OfferingWorkspaceData } from "@/lib/programs/offering-workspace-types"
import type { OfferingAudienceType } from "@/lib/programs/program-offering-attributes"
import {
  resolveEffectiveOfferingRegistrationSource,
} from "@/lib/programs/program-offering-inherit"
import { isOfferingEnrollmentOpen } from "@/lib/programs/program-offering-display"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import type { ProgramSession } from "@/lib/programs/program-session-types"
import { saveRegistrationQuestionsForOffering } from "@/lib/programs/program-registration-question-actions"
import {
  parseRegistrationQuestions,
  type RegistrationQuestionInput,
} from "@/lib/programs/program-registration-question-types"
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
    application_required: offering.application_required !== false,
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
  disabled = false,
  sections,
  plain = false,
  /** Render Registration + Participants as numbered accordion items (shared state). */
  settingsSplit = false,
  /** When settingsSplit, portal the Capacity accordion into this DOM node (above Sessions). */
  capacityAccordionPortalTarget = null,
  /**
   * When provided (including null while mounting), Questions portals here
   * instead of rendering after Enrollment.
   */
  questionsAccordionPortalTarget,
  /** Paired left of Registration in the settings two-column row. */
  generalSection = null,
  /** Paired right of Participants (e.g. Pricing) in the settings two-column row. */
  participantsCompanion = null,
  attendanceTracked,
  onAttendanceTrackedChange,
  onDirty,
  /** Hide basics already on the parent edit form; keep advanced controls. */
  omitBasicFields = false,
  /** Sync basic field values from the parent form before save. */
  basicFieldOverrides = null,
  onSessionsChange,
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
  /** When false, parent provides a shared Save (e.g. offering manage Settings). */
  showSaveButton?: boolean
  saveHandlerRef?: React.MutableRefObject<(() => Promise<boolean>) | null>
  /** When true, all settings fields are locked (read-only settings view). */
  disabled?: boolean
  /** Which registration blocks to render (default: all). */
  sections?: Array<"window" | "eligibility" | "capacity">
  plain?: boolean
  settingsSplit?: boolean
  capacityAccordionPortalTarget?: HTMLElement | null
  questionsAccordionPortalTarget?: HTMLElement | null
  generalSection?: React.ReactNode
  participantsCompanion?: React.ReactNode
  /** Controlled attendance flag (offering attribute); falls back to offering. */
  attendanceTracked?: boolean
  onAttendanceTrackedChange?: (enabled: boolean) => void
  onDirty?: () => void
  omitBasicFields?: boolean
  basicFieldOverrides?: {
    enrollmentOpenDate?: string
    enrollmentCloseDate?: string
    openEnrollment?: boolean
    gender?: ProgramGender
    minAge?: number | null
    maxAge?: number | null
    capacity?: number
  } | null
  onSessionsChange?: (sessions: ProgramSession[]) => void
}) {
  const router = useRouter()
  const capacitySectionRef =
    React.useRef<OfferingRegistrationCapacitySectionHandle>(null)
  const showWindow =
    settingsSplit || !sections || sections.includes("window")
  const showEligibility =
    (!settingsSplit && (!sections || sections.includes("eligibility"))) ||
    (settingsSplit && !omitBasicFields)
  const showCapacity =
    (!settingsSplit && (!sections || sections.includes("capacity"))) ||
    (settingsSplit && !omitBasicFields)
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
  const [openEnrollment, setOpenEnrollment] = React.useState(
    !source.application_required
  )
  const [waitlistCapacity, setWaitlistCapacity] = React.useState(
    source.waitlist_capacity?.toString() ?? ""
  )
  const [registrationQuestions, setRegistrationQuestions] = React.useState<
    RegistrationQuestionInput[]
  >(() => parseRegistrationQuestions(workspaceData.registrationQuestions ?? []))
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
    setOpenEnrollment(!source.application_required)
    setWaitlistCapacity(source.waitlist_capacity?.toString() ?? "")
  }, [source, offering])

  const registrationQuestionsSignature = React.useMemo(
    () =>
      JSON.stringify(
        (workspaceData.registrationQuestions ?? []).map((row) => [
          row.id,
          row.prompt,
          row.question_type,
          row.is_required,
          row.sort_order,
        ])
      ),
    [workspaceData.registrationQuestions]
  )

  React.useEffect(() => {
    setRegistrationQuestions(
      parseRegistrationQuestions(workspaceData.registrationQuestions ?? [])
    )
  }, [offering.id, registrationQuestionsSignature])

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
      const nextOpenEnrollment =
        basicFieldOverrides?.openEnrollment ?? openEnrollment
      const nextEnrollmentOpenDate =
        basicFieldOverrides?.enrollmentOpenDate ?? enrollmentOpenDate
      const nextEnrollmentCloseDate =
        basicFieldOverrides?.enrollmentCloseDate ?? enrollmentCloseDate
      const nextGender = basicFieldOverrides?.gender ?? programGender
      const nextMinAge =
        basicFieldOverrides?.minAge !== undefined
          ? basicFieldOverrides.minAge
          : minAge
      const nextMaxAge =
        basicFieldOverrides?.maxAge !== undefined
          ? basicFieldOverrides.maxAge
          : maxAge
      const nextCapacity =
        basicFieldOverrides?.capacity !== undefined
          ? basicFieldOverrides.capacity
          : capacity

      const flushedCapacityGroups =
        capacitySectionRef.current?.flushCapacityGroups() ??
        normalizedCapacityGroups

      const registrationOptions = await saveOfferingRegistrationPanel({
        programId: program.id,
        offeringId: offering.id,
        organizationId: program.organization_id,
        min_age: nextMinAge,
        max_age: nextMaxAge,
        grade_levels: gradeLevels,
        gender: nextGender,
        enrollment_open_date: nextEnrollmentOpenDate || null,
        enrollment_close_date: nextEnrollmentCloseDate || null,
        fullProgramEnabled,
        sessionRegistrationEnabled,
        singleSessionEnabled,
        dropInEnabled: false,
        capacity: nextCapacity,
        capacityGroups: flushedCapacityGroups,
        enable_waitlist: enableWaitlist,
        waitlist_capacity:
          waitlistCapacity.trim() === "" ? null : Number(waitlistCapacity),
        application_required: !nextOpenEnrollment,
        inherit_dates: false,
        inherit_eligibility: false,
        inherit_enrollment: false,
      })
      await saveRegistrationQuestionsForOffering({
        programId: program.id,
        offeringId: offering.id,
        questions: registrationQuestions,
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

  function touch() {
    onDirty?.()
  }

  const windowCard = showWindow ? (
    <OfferingEnrollmentWindowCard
      fullProgramEnabled={fullProgramEnabled}
      sessionRegistrationEnabled={sessionRegistrationEnabled}
      singleSessionEnabled={singleSessionEnabled}
      onFullProgramChange={(value) => {
        setFullProgramEnabled(value)
        touch()
      }}
      onSessionRegistrationChange={(value) => {
        setSessionRegistrationEnabled(value)
        touch()
      }}
      onSingleSessionChange={(value) => {
        setSingleSessionEnabled(value)
        touch()
      }}
      enrollmentOpenDate={enrollmentOpenDate}
      enrollmentCloseDate={enrollmentCloseDate}
      onEnrollmentOpenDateChange={(value) => {
        setEnrollmentOpenDate(value)
        touch()
      }}
      onEnrollmentCloseDateChange={(value) => {
        setEnrollmentCloseDate(value)
        touch()
      }}
      registrationOpen={registrationOpen}
      enableWaitlist={enableWaitlist}
      onEnableWaitlistChange={(value) => {
        setEnableWaitlist(value)
        touch()
      }}
      openEnrollment={openEnrollment}
      onOpenEnrollmentChange={(value) => {
        setOpenEnrollment(value)
        touch()
      }}
      attendanceTracked={
        attendanceTracked ?? Boolean(offering.attendance_tracked)
      }
      onAttendanceTrackedChange={(value) => {
        onAttendanceTrackedChange?.(value)
        touch()
      }}
      disabled={disabled}
      plain={plain || settingsSplit}
      hideBasicFields={omitBasicFields}
      showOptionToggles={!settingsSplit}
    />
  ) : null

  const enrollmentOptionToggles = settingsSplit ? (
    <OfferingEnrollmentOptionToggles
      enableWaitlist={enableWaitlist}
      onEnableWaitlistChange={(value) => {
        setEnableWaitlist(value)
        touch()
      }}
      attendanceTracked={
        attendanceTracked ?? Boolean(offering.attendance_tracked)
      }
      onAttendanceTrackedChange={(value) => {
        onAttendanceTrackedChange?.(value)
        touch()
      }}
      openEnrollment={openEnrollment}
      onOpenEnrollmentChange={(value) => {
        setOpenEnrollment(value)
        touch()
      }}
      disabled={disabled}
      compactLabels
    />
  ) : null

  const eligibilityCard = showEligibility ? (
    <OfferingEligibilityCard
      audienceType={audienceType}
      onAudienceTypeChange={(value) => {
        setAudienceType(value)
        touch()
      }}
      minAge={minAge}
      maxAge={maxAge}
      onMinAgeChange={(value) => {
        setMinAge(value)
        touch()
      }}
      onMaxAgeChange={(value) => {
        setMaxAge(value)
        touch()
      }}
      gradeLevels={gradeLevels}
      onGradeLevelsChange={(value) => {
        setGradeLevels(value)
        touch()
      }}
      programGender={programGender}
      onProgramGenderChange={(value) => {
        setProgramGender(value)
        touch()
      }}
      disabled={disabled}
      plain={plain || settingsSplit}
      hideAudience={settingsSplit}
      hideGenderAndAges={omitBasicFields}
    />
  ) : null

  const capacityCard = showCapacity ? (
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
      onCapacityChange={(value) => {
        setCapacity(value)
        touch()
      }}
      capacityGroups={normalizedCapacityGroups}
      onCapacityGroupsChange={(groups) => {
        onCapacityGroupsChange(groups)
        touch()
      }}
      enableWaitlist={enableWaitlist}
      waitlistCapacity={waitlistCapacity}
      onWaitlistCapacityChange={(value) => {
        setWaitlistCapacity(value)
        touch()
      }}
      enrolled={enrolled}
      disabled={disabled}
      plain={plain || settingsSplit}
      hideSimpleCapacity={omitBasicFields}
    />
  ) : null

  const statusMessages = (
    <>
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
    </>
  )

  if (settingsSplit) {
    const capacityAccordion =
      showCapacity && capacityCard ? (
        <OfferingSettingsAccordionItem
          value="capacity"
          title="Capacity"
        >
          {capacityCard}
        </OfferingSettingsAccordionItem>
      ) : null

    const questionsAccordion = (
      <OfferingSettingsAccordionItem
        value="questions"
        title="Questions"
      >
        <OfferingRegistrationQuestionsEditor
          questions={registrationQuestions}
          disabled={disabled}
          onChange={(next) => {
            setRegistrationQuestions(next)
            touch()
          }}
        />
      </OfferingSettingsAccordionItem>
    )

    return (
      <>
        <OfferingSettingsAccordionItem
          value="registration"
          title="Enrollment"
        >
          <div className="space-y-3">
            {windowCard}
            {sessionRegistrationEnabled ? (
              <div className="border-t pt-3">
                <ProgramSessionsEditor
                  programId={program.id}
                  offeringId={offering.id}
                  sessions={workspaceData.sessions}
                  sessionRegistrationEnabled
                  variant="basic"
                  disabled={disabled}
                  onSessionsChange={onSessionsChange}
                />
              </div>
            ) : null}
            {enrollmentOptionToggles}
            {statusMessages}
          </div>
        </OfferingSettingsAccordionItem>
        {eligibilityCard ? (
          <OfferingSettingsAccordionItem
            value="participants"
            title="Participants"
          >
            {eligibilityCard}
          </OfferingSettingsAccordionItem>
        ) : null}
        {questionsAccordionPortalTarget !== undefined
          ? questionsAccordionPortalTarget
            ? createPortal(questionsAccordion, questionsAccordionPortalTarget)
            : null
          : questionsAccordion}
        {capacityAccordion && capacityAccordionPortalTarget
          ? createPortal(capacityAccordion, capacityAccordionPortalTarget)
          : capacityAccordion}
      </>
    )
  }

  return (
    <div className="space-y-4">
      {windowCard}
      {eligibilityCard}
      {capacityCard}
      {statusMessages}

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

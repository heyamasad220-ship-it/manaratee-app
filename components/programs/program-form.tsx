"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EligibilitySection } from "@/components/programs/edit/eligibility-section"
import { EditProgramStickyFooter } from "@/components/programs/edit/edit-program-sticky-footer"
import { EnrollmentSettingsSection } from "@/components/programs/edit/enrollment-settings-section"
import { FeePlansSection } from "@/components/programs/edit/fee-plans-section"
import { ProgramBasicsSection } from "@/components/programs/edit/program-basics-section"
import { ProgramOfferingsSection } from "@/components/programs/edit/program-offerings-section"
import type {
  ProgramWithExtraFields,
  VisibilityType,
} from "@/components/programs/edit/types"
import {
  ageSelectValue,
  getInitialGradeLevels,
  getMinMaxGradeFromLevels,
  getNumberOrNull,
  gradesApplyForMinAge,
  inferProgramTypeFromMinAge,
} from "@/components/programs/edit/utils"
import type { FeePlanEditorState } from "@/components/programs/program-fee-plan-editor"
import type { Department } from "@/lib/departments/department-types"
import { createProgram } from "@/lib/programs/program-actions"
import { replaceProgramCapacityGroups } from "@/lib/programs/program-capacity-group-actions"
import type { ProgramCapacityGroupInput } from "@/lib/programs/program-capacity-group-types"
import {
  getPersistableCapacityGroups,
  normalizeCapacityGroups,
} from "@/lib/programs/program-capacity-group-utils"
import { getProgramSaveContext } from "@/lib/programs/get-program-save-context"
import { saveEditProgram } from "@/lib/programs/save-edit-program"
import type {
  ProgramOfferingDiscountRule,
  ProgramOfferingFeePlan,
  ProgramOfferingFeePlanComponent,
} from "@/lib/programs/program-fee-plan-types"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import type { OfferingWorkspaceDataMap } from "@/lib/programs/offering-workspace-types"
import type { InvalidFeePlanLink } from "@/lib/programs/program-fee-plan-queries"
import type { ProgramRegistrationOption } from "@/lib/programs/program-registration-option-types"
import type { Program } from "@/lib/programs/program-types"
import {
  getAgeGroupLabelsFromMinMax,
  parseProgramAgeBounds,
} from "@/lib/programs/program-eligibility-display"

const PROGRAM_FORM_TABS = [
  { value: "basics", label: "General", editOnly: false },
  { value: "offerings", label: "Offerings", editOnly: true },
] as const

type ProgramFormTab = (typeof PROGRAM_FORM_TABS)[number]["value"]

function getTabIndex(tab: ProgramFormTab, tabs = PROGRAM_FORM_TABS) {
  return tabs.findIndex((item) => item.value === tab)
}

function getNextTab(
  tab: ProgramFormTab,
  tabs: typeof PROGRAM_FORM_TABS = PROGRAM_FORM_TABS
): ProgramFormTab | null {
  const index = getTabIndex(tab, tabs)
  if (index < 0 || index >= tabs.length - 1) {
    return null
  }

  return tabs[index + 1].value
}

function resolveInitialTab(tabParam: string | null): ProgramFormTab {
  if (tabParam === "overview") {
    return "basics"
  }

  if (tabParam === "sessions") {
    return "offerings"
  }

  if (tabParam === "registration") {
    return "offerings"
  }

  if (tabParam === "pricing") {
    return "offerings"
  }

  if (tabParam === "enrollment") {
    return "basics"
  }

  if (tabParam && PROGRAM_FORM_TABS.some((tab) => tab.value === tabParam)) {
    return tabParam as ProgramFormTab
  }

  return "basics"
}

type ProgramFormEditProps = {
  mode: "edit"
  program: Program
  departments: Department[]
  capacityGroups: ProgramCapacityGroupInput[]
  offerings: ProgramOffering[]
  registrationOptions: ProgramRegistrationOption[]
  defaultOffering: ProgramOffering | null
  offeringWorkspaceData: OfferingWorkspaceDataMap
}

type ProgramFormCreateProps = {
  mode: "create"
  departments: Department[]
  organizationId: string
}

export type ProgramFormProps = ProgramFormEditProps | ProgramFormCreateProps

function buildFormPayload(
  formData: FormData,
  gradeLevels: string[],
  fallbackProgram: Program | null = null,
  isCreate = false
) {
  const minAgeValue = isCreate
    ? getNumberOrNull(formData.get("min_age"))
    : fallbackProgram
      ? parseProgramAgeBounds(fallbackProgram).minAge
      : getNumberOrNull(formData.get("min_age"))
  const maxAgeValue = isCreate
    ? getNumberOrNull(formData.get("max_age"))
    : fallbackProgram
      ? parseProgramAgeBounds(fallbackProgram).maxAge
      : getNumberOrNull(formData.get("max_age"))
  const selectedProgramType = inferProgramTypeFromMinAge(minAgeValue)
  const selectedVisibility = String(
    formData.get("visibility") ||
      (fallbackProgram as ProgramWithExtraFields | null)?.visibility ||
      "public"
  ) as VisibilityType
  const selectedGender = isCreate
    ? String(formData.get("gender") || fallbackProgram?.gender || "All")
    : String(fallbackProgram?.gender || "All")

  const finalGradeLevels = isCreate
    ? selectedProgramType === "adult"
      ? []
      : gradeLevels
    : selectedProgramType === "adult"
      ? []
      : fallbackProgram
        ? getInitialGradeLevels(fallbackProgram)
        : []
  const { minGrade: finalMinGrade, maxGrade: finalMaxGrade } =
    selectedProgramType === "adult"
      ? { minGrade: null, maxGrade: null }
      : getMinMaxGradeFromLevels(finalGradeLevels)
  const finalAgeGroups = getAgeGroupLabelsFromMinMax(minAgeValue, maxAgeValue)

  return {
    minAgeValue,
    maxAgeValue,
    selectedProgramType,
    selectedVisibility,
    selectedGender,
    finalGradeLevels,
    finalMinGrade,
    finalMaxGrade,
    finalAgeGroups,
    name: String(formData.get("name") || fallbackProgram?.name || ""),
    subtitle:
      String(formData.get("subtitle") || fallbackProgram?.subtitle || "") ||
      null,
    description: String(
      formData.get("description") || fallbackProgram?.description || ""
    ),
    department_id:
      String(formData.get("department_id") || fallbackProgram?.department_id || "") ||
      null,
    flyer_url:
      String(formData.get("flyer_url") || fallbackProgram?.flyer_url || "") ||
      null,
    background_color:
      String(
        formData.get("background_color") || fallbackProgram?.background_color || ""
      ) || null,
    start_date: isCreate
      ? null
      : fallbackProgram?.start_date ?? null,
    end_date: isCreate
      ? null
      : fallbackProgram?.end_date ?? null,
    enrollment_open_date: isCreate
      ? String(formData.get("enrollment_open_date") || "") || null
      : fallbackProgram?.enrollment_open_date ?? null,
    enrollment_close_date: isCreate
      ? String(formData.get("enrollment_close_date") || "") || null
      : fallbackProgram?.enrollment_close_date ?? null,
    enable_waitlist: fallbackProgram?.enable_waitlist ?? false,
    waitlist_capacity: fallbackProgram?.waitlist_capacity ?? null,
    status: String(formData.get("status") || fallbackProgram?.status || "draft"),
    financial_assistance_enabled: formData.has("financial_assistance_enabled")
      ? formData.get("financial_assistance_enabled") === "on"
      : (fallbackProgram?.financial_assistance_enabled ?? false),
    financial_assistance_open: formData.has("financial_assistance_open")
      ? formData.get("financial_assistance_open") === "on"
      : (fallbackProgram?.financial_assistance_open ?? false),
    financial_assistance_close_date:
      String(
        formData.get("financial_assistance_close_date") ||
          fallbackProgram?.financial_assistance_close_date ||
          ""
      ) || null,
    financial_assistance_instructions:
      String(
        formData.get("financial_assistance_instructions") ||
          fallbackProgram?.financial_assistance_instructions ||
          ""
      ) || null,
  }
}

function getProgramRegistrationFlags(
  program: Program | null,
  registrationOptions: ProgramRegistrationOption[],
  isCreate: boolean
) {
  if (isCreate) {
    return {
      full_program_registration_enabled: true,
      session_registration_enabled: false,
      single_session_registration_enabled: false,
      drop_in_registration_enabled: false,
    }
  }

  return {
    full_program_registration_enabled: registrationOptions.some(
      (option) => option.option_type === "full_program" && option.is_active
    ),
    session_registration_enabled: registrationOptions.some(
      (option) => option.option_type === "selected_sessions" && option.is_active
    ),
    single_session_registration_enabled: registrationOptions.some(
      (option) => option.option_type === "single_session" && option.is_active
    ),
    drop_in_registration_enabled: registrationOptions.some(
      (option) => option.option_type === "drop_in" && option.is_active
    ),
  }
}

function getDefaultOfferingRegistrationOptions(
  offeringWorkspaceData: OfferingWorkspaceDataMap,
  defaultOfferingId: string | null,
  fallback: ProgramRegistrationOption[]
) {
  if (!defaultOfferingId) {
    return fallback
  }

  return (
    offeringWorkspaceData[defaultOfferingId]?.registrationOptions ?? fallback
  )
}

export function ProgramForm(props: ProgramFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const formRef = React.useRef<HTMLFormElement>(null)
  const continueAfterSaveRef = React.useRef(false)
  const isCreate = props.mode === "create"
  const visibleTabs = React.useMemo(
    () =>
      isCreate
        ? PROGRAM_FORM_TABS.filter((tab) => !tab.editOnly)
        : PROGRAM_FORM_TABS,
    [isCreate]
  )
  const [activeTab, setActiveTab] = React.useState<ProgramFormTab>(() => {
    const tab = resolveInitialTab(searchParams.get("tab"))
    if (isCreate && tab === "offerings") {
      return "basics"
    }
    return tab
  })
  const [maxUnlockedTabIndex, setMaxUnlockedTabIndex] = React.useState(() => {
    if (isCreate) {
      return 0
    }

    if (searchParams.get("created") === "1") {
      return Math.max(
        getTabIndex(resolveInitialTab(searchParams.get("tab")), visibleTabs),
        1
      )
    }

    return visibleTabs.length - 1
  })

  const program = isCreate ? null : props.program
  const typedProgram = program as ProgramWithExtraFields | null
  const initialAgeBounds = React.useMemo(
    () => (program ? parseProgramAgeBounds(program) : { minAge: null, maxAge: null }),
    [program]
  )

  const initialVisibility = (typedProgram?.visibility || "public") as VisibilityType

  const registrationOptions = isCreate ? [] : props.registrationOptions
  const defaultOffering = isCreate ? null : props.defaultOffering
  const feePlans: ProgramOfferingFeePlan[] = []
  const feePlanComponents: ProgramOfferingFeePlanComponent[] = []
  const feePlanDiscountRules: ProgramOfferingDiscountRule[] = []
  const invalidFeePlanLinks: InvalidFeePlanLink[] = []
  const organizationId = isCreate
    ? props.organizationId
    : props.program.organization_id

  const [isSaving, setIsSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = React.useState(false)
  const [showCreatedBanner, setShowCreatedBanner] = React.useState(false)
  const [minAge, setMinAge] = React.useState<number | null>(initialAgeBounds.minAge)
  const [maxAge, setMaxAge] = React.useState<number | null>(initialAgeBounds.maxAge)
  const [programGender, setProgramGender] = React.useState<
    "All" | "Male" | "Female"
  >((program?.gender as "All" | "Male" | "Female") || "All")
  const [gradeLevels, setGradeLevels] = React.useState<string[]>(
    program ? getInitialGradeLevels(program) : []
  )
  const [programStatus, setProgramStatus] = React.useState(
    program?.status ?? "draft"
  )
  const [capacityGroups, setCapacityGroups] = React.useState<
    ProgramCapacityGroupInput[]
  >(isCreate ? [] : props.capacityGroups)
  const createFeePlanStateRef = React.useRef<FeePlanEditorState | null>(null)
  const handleFeePlanChange = React.useCallback(
    (state: FeePlanEditorState) => {
      if (!isCreate) {
        return
      }
      createFeePlanStateRef.current = state
    },
    [isCreate]
  )

  function getFeePlanStateForSave(fallbackOfferingId?: string | null) {
    if (!isCreate) {
      return { offeringId: null, feePlanState: null }
    }

    return {
      offeringId: fallbackOfferingId ?? null,
      feePlanState: createFeePlanStateRef.current,
    }
  }

  function getCapacityGroupsForSave(gradeLevelsForSave: string[]) {
    if (isCreate) {
      return []
    }

    return getPersistableCapacityGroups(
      normalizeCapacityGroups(capacityGroups, gradeLevelsForSave),
      gradeLevelsForSave
    )
  }

  function getTotalCapacityForSave(
    persistedCapacityGroups: ProgramCapacityGroupInput[]
  ) {
    return program?.capacity ?? 0
  }

  const createdParam = searchParams.get("created")
  const offeringParam = searchParams.get("offering")
  const tabParam = searchParams.get("tab")
  const searchQueryWithoutCreated = React.useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("created")
    return params.toString()
  }, [searchParams])
  const capacityGroupsSignature = React.useMemo(
    () => (isCreate ? "" : JSON.stringify(props.capacityGroups)),
    [isCreate, props.capacityGroups]
  )
  const clearedCreatedQueryRef = React.useRef(false)

  React.useEffect(() => {
    if (program?.status) {
      setProgramStatus(program.status)
    }
  }, [program?.status])

  React.useEffect(() => {
    if (isCreate || !capacityGroupsSignature) {
      return
    }

    setCapacityGroups(props.capacityGroups)
    // Intentionally sync from server payload signature, not array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- props.capacityGroups tracked via signature
  }, [isCreate, capacityGroupsSignature])

  React.useEffect(() => {
    if (!gradesApplyForMinAge(minAge)) {
      setGradeLevels([])
    }
  }, [minAge])

  React.useEffect(() => {
    if (isCreate) {
      return
    }

    if (offeringParam || tabParam === "offerings") {
      setActiveTab("offerings")
    }
  }, [isCreate, offeringParam, tabParam])

  React.useEffect(() => {
    if (isCreate || createdParam !== "1" || !program?.id) {
      return
    }

    if (clearedCreatedQueryRef.current) {
      return
    }

    clearedCreatedQueryRef.current = true
    setShowCreatedBanner(true)

    const query = searchQueryWithoutCreated
    router.replace(
      `/programs/${program.id}/edit${query ? `?${query}` : ""}`,
      { scroll: false }
    )
  }, [isCreate, createdParam, program?.id, router, searchQueryWithoutCreated])

  function handleTabChange(value: string) {
    const nextTab = value as ProgramFormTab
    const targetIndex = getTabIndex(nextTab, visibleTabs)

    if (targetIndex > maxUnlockedTabIndex) {
      setSaveError("Save this tab before moving to the next section.")
      return
    }

    setSaveError(null)
    setActiveTab(nextTab)
  }

  function handleSaveAndContinue() {
    const nextTab = getNextTab(activeTab, visibleTabs)
    if (!nextTab) {
      return
    }

    continueAfterSaveRef.current = true
    formRef.current?.requestSubmit()
  }

  async function handleCreateSubmit(
    payload: ReturnType<typeof buildFormPayload>
  ) {
    if (!payload.name.trim()) {
      setSaveError("Program name is required.")
      continueAfterSaveRef.current = false
      return
    }

    if (
      payload.minAgeValue !== null &&
      payload.maxAgeValue !== null &&
      payload.minAgeValue > payload.maxAgeValue
    ) {
      setSaveError("Minimum age cannot be greater than maximum age.")
      continueAfterSaveRef.current = false
      return
    }

    const persistedCapacityGroups = getCapacityGroupsForSave(
      payload.finalGradeLevels
    )
    const persistedTotalCapacity = getTotalCapacityForSave(
      persistedCapacityGroups
    )

    const registrationFlags = getProgramRegistrationFlags(
      program,
      registrationOptions,
      isCreate
    )

    const programId = await createProgram({
      name: payload.name.trim(),
      subtitle: payload.subtitle,
      description: payload.description,
      department_id: payload.department_id,
      flyer_url: payload.flyer_url,
      background_color: payload.background_color,
      program_type: payload.selectedProgramType,
      start_date: payload.start_date,
      end_date: payload.end_date,
      enrollment_open_date: payload.enrollment_open_date,
      enrollment_close_date: payload.enrollment_close_date,
      min_age: payload.minAgeValue,
      max_age: payload.maxAgeValue,
      grade_levels: payload.finalGradeLevels,
      min_grade: payload.finalMinGrade,
      max_grade: payload.finalMaxGrade,
      gender: payload.selectedGender,
      capacity: persistedTotalCapacity,
      status: "draft",
      visibility: payload.selectedVisibility,
      full_program_registration_enabled:
        registrationFlags.full_program_registration_enabled,
      session_registration_enabled:
        registrationFlags.session_registration_enabled,
    })

    if (
      persistedCapacityGroups.length > 0 &&
      (payload.minAgeValue == null || payload.minAgeValue < 18)
    ) {
      await replaceProgramCapacityGroups({
        program_id: programId,
        groups: persistedCapacityGroups,
      })
    }

    const { program: savedProgram, offeringId } =
      await getProgramSaveContext(programId)

    const { offeringId: createOfferingId, feePlanState: createFeePlanState } =
      getFeePlanStateForSave(offeringId)

    const result = await saveEditProgram({
      program: savedProgram,
      formData: {
        name: payload.name,
        subtitle: payload.subtitle,
        description: payload.description,
        department_id: payload.department_id,
        flyer_url: payload.flyer_url,
        background_color: payload.background_color,
        start_date: payload.start_date,
        end_date: payload.end_date,
        enrollment_open_date: payload.enrollment_open_date,
        enrollment_close_date: payload.enrollment_close_date,
        program_type: payload.selectedProgramType,
        min_age: payload.minAgeValue,
        max_age: payload.maxAgeValue,
        min_grade: payload.finalMinGrade,
        max_grade: payload.finalMaxGrade,
        age_groups: payload.finalAgeGroups,
        grade_levels: payload.finalGradeLevels,
        gender: payload.selectedGender,
        full_program_registration_enabled:
          registrationFlags.full_program_registration_enabled,
        session_registration_enabled:
          registrationFlags.session_registration_enabled,
        single_session_registration_enabled:
          registrationFlags.single_session_registration_enabled,
        drop_in_registration_enabled:
          registrationFlags.drop_in_registration_enabled,
        capacity: persistedTotalCapacity,
        enable_waitlist: payload.enable_waitlist,
        waitlist_capacity: payload.waitlist_capacity,
        status: payload.status,
        visibility: payload.selectedVisibility,
        financial_assistance_enabled: payload.financial_assistance_enabled,
        financial_assistance_open: payload.financial_assistance_open,
        financial_assistance_close_date: payload.financial_assistance_close_date,
        financial_assistance_instructions: payload.financial_assistance_instructions,
      },
      capacityGroups: persistedCapacityGroups,
      offeringId: createOfferingId ?? offeringId,
      feePlanState: createFeePlanState,
    })

    if (!result.success) {
      setSaveError(result.error)
      continueAfterSaveRef.current = false
      return
    }

    const nextTab = continueAfterSaveRef.current ? "offerings" : activeTab
    continueAfterSaveRef.current = false

    router.replace(`/programs/${programId}`)
  }

  async function handleEditSubmit(
    payload: ReturnType<typeof buildFormPayload>
  ) {
    if (!payload.name.trim()) {
      setSaveError("Program name is required.")
      continueAfterSaveRef.current = false
      return
    }

    if (
      payload.minAgeValue !== null &&
      payload.maxAgeValue !== null &&
      payload.minAgeValue > payload.maxAgeValue
    ) {
      setSaveError("Minimum age cannot be greater than maximum age.")
      continueAfterSaveRef.current = false
      return
    }

    const persistedCapacityGroups = getCapacityGroupsForSave(
      payload.finalGradeLevels
    )
    const persistedTotalCapacity = getTotalCapacityForSave(
      persistedCapacityGroups
    )

    const registrationFlags = getProgramRegistrationFlags(
      program,
      getDefaultOfferingRegistrationOptions(
        props.offeringWorkspaceData,
        defaultOffering?.id ?? null,
        registrationOptions
      ),
      false
    )

    const result = await saveEditProgram({
      program: program!,
      formData: {
        name: payload.name,
        subtitle: payload.subtitle,
        description: payload.description,
        department_id: payload.department_id,
        flyer_url: payload.flyer_url,
        background_color: payload.background_color,
        start_date: payload.start_date,
        end_date: payload.end_date,
        enrollment_open_date: payload.enrollment_open_date,
        enrollment_close_date: payload.enrollment_close_date,
        program_type: payload.selectedProgramType,
        min_age: payload.minAgeValue,
        max_age: payload.maxAgeValue,
        min_grade: payload.finalMinGrade,
        max_grade: payload.finalMaxGrade,
        age_groups: payload.finalAgeGroups,
        grade_levels: payload.finalGradeLevels,
        gender: payload.selectedGender,
        full_program_registration_enabled:
          registrationFlags.full_program_registration_enabled,
        session_registration_enabled:
          registrationFlags.session_registration_enabled,
        single_session_registration_enabled:
          registrationFlags.single_session_registration_enabled,
        drop_in_registration_enabled:
          registrationFlags.drop_in_registration_enabled,
        capacity: persistedTotalCapacity,
        enable_waitlist: payload.enable_waitlist,
        waitlist_capacity: payload.waitlist_capacity,
        status: payload.status,
        visibility: payload.selectedVisibility,
        financial_assistance_enabled: payload.financial_assistance_enabled,
        financial_assistance_open: payload.financial_assistance_open,
        financial_assistance_close_date: payload.financial_assistance_close_date,
        financial_assistance_instructions: payload.financial_assistance_instructions,
      },
      capacityGroups: [],
      offeringId: null,
      feePlanState: null,
      skipCapacityGroups: true,
    })

    if (!result.success) {
      setSaveError(result.error)
      continueAfterSaveRef.current = false
      return
    }

    setMinAge(payload.minAgeValue)
    setMaxAge(payload.maxAgeValue)
    setProgramStatus(payload.status)
    setSaveSuccess(true)
    setMaxUnlockedTabIndex((current) =>
      Math.min(
        visibleTabs.length - 1,
        Math.max(current, getTabIndex(activeTab, visibleTabs) + 1)
      )
    )

    if (continueAfterSaveRef.current) {
      const nextTab = getNextTab(activeTab, visibleTabs)
      continueAfterSaveRef.current = false
      if (nextTab) {
        setActiveTab(nextTab)
      }
    }

    router.refresh()
  }

  async function handleSubmit(formData: FormData) {
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    const payload = buildFormPayload(formData, gradeLevels, program, isCreate)

    try {
      if (isCreate) {
        await handleCreateSubmit(payload)
      } else {
        await handleEditSubmit(payload)
      }
    } catch (error) {
      console.error(error)
      continueAfterSaveRef.current = false
      setSaveError(
        error instanceof Error
          ? error.message
          : isCreate
            ? "Failed to create program. Please try again."
            : "Failed to save program. Please try again."
      )
    } finally {
      setIsSaving(false)
    }
  }

  const backHref = "/programs/catalog"
  const pageTitle = isCreate ? "Create Program" : "Edit Program"
  const pageDescription = isCreate
    ? "Work through each tab in order. Save a tab before moving on. New programs start as Draft."
    : "Save each tab as you go. The program stays Draft until you set status to Active on the General tab."
  const isLastTab =
    activeTab === visibleTabs[visibleTabs.length - 1]?.value

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="border-b bg-background/95">
        <div className="flex h-14 items-center gap-4 px-6">
          <Link
            href={backHref}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {isCreate ? "Back to Programs" : "Back to Program"}
          </Link>

          <div className="ml-auto">
            <Badge variant="secondary">{isCreate ? "Creating" : "Editing"}</Badge>
          </div>
        </div>
      </div>

      <form
        ref={formRef}
        onSubmit={async (event) => {
          event.preventDefault()
          const formData = new FormData(event.currentTarget)
          await handleSubmit(formData)
        }}
        className="px-6 py-5"
      >
        <input type="hidden" name="min_age" value={ageSelectValue(minAge)} />
        <input type="hidden" name="max_age" value={ageSelectValue(maxAge)} />

        <div className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight">{pageTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{pageDescription}</p>
          {showCreatedBanner ? (
            <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              Program created. Add offerings — these are what customers register
              for (for example, Beginner ESL or June Camp).
            </p>
          ) : null}
          {saveError ? (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {saveError}
            </p>
          ) : null}
          {saveSuccess ? (
            <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Program saved successfully.
            </p>
          ) : null}
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-4">
          <TabsList>
            {visibleTabs.map((tab, index) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                disabled={index > maxUnlockedTabIndex}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent forceMount value="basics" className="mt-0 space-y-4">
            <ProgramBasicsSection
              program={program}
              programId={program?.id}
              departments={props.departments}
              status={programStatus}
              onStatusChange={setProgramStatus}
              initialVisibility={initialVisibility}
              programStatusFallback={program?.status ?? "draft"}
            />
            {props.departments.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No departments found. Add departments in Settings first.
              </p>
            ) : null}
            {isCreate ? (
              <>
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
                <EnrollmentSettingsSection program={program} />
                <FeePlansSection
                  draftMode
                  programId={program?.id ?? ""}
                  offeringId={defaultOffering?.id ?? ""}
                  feePlans={feePlans}
                  feePlanComponents={feePlanComponents}
                  feePlanDiscountRules={feePlanDiscountRules}
                  registrationOptions={registrationOptions}
                  invalidFeePlanLinks={invalidFeePlanLinks}
                  onChange={handleFeePlanChange}
                />
                <p className="text-xs text-muted-foreground">
                  Fee plan links to registration options are finalized when you
                  save the program for the first time. After that, configure
                  pricing per offering on the Offerings tab. Promo codes are
                  managed in Programs → Settings → Promo Codes.
                </p>
              </>
            ) : null}
          </TabsContent>

          {!isCreate ? (
            <TabsContent value="offerings" className="mt-0 space-y-4">
              <ProgramOfferingsSection
                program={program!}
                offerings={props.offerings}
                workspaceDataMap={props.offeringWorkspaceData}
                capacityGroups={capacityGroups}
                onCapacityGroupsChange={setCapacityGroups}
              />
            </TabsContent>
          ) : null}
        </Tabs>

        <EditProgramStickyFooter
          isSaving={isSaving}
          isLastTab={isLastTab}
          onSaveAndContinue={handleSaveAndContinue}
        />
      </form>
    </div>
  )
}

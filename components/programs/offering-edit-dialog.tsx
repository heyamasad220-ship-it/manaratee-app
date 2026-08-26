"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronRight, Loader2, Trash2 } from "lucide-react"

import type { ProgramGender } from "@/components/programs/edit/types"
import { ADULT_MIN_AGE } from "@/components/programs/edit/utils"
import { OfferingBasicsForm } from "@/components/programs/offering-basics-form"
import { OfferingOverviewStaffFields } from "@/components/programs/edit/offering-overview-staff-fields"
import {
  OfferingPricingPanel,
  OfferingPricingProvider,
} from "@/components/programs/edit/offering-pricing-panel"
import { OfferingRegistrationPanel } from "@/components/programs/edit/offering-registration-panel"
import { OfferingSettingsAccordionItem } from "@/components/programs/edit/offering-settings-section"
import {
  OfferingSchedulePanel,
} from "@/components/programs/edit/offering-workspace-panels"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Accordion } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { OfferingManageSummary } from "@/lib/programs/offering-manage-summary"
import type { OfferingWorkspaceData } from "@/lib/programs/offering-workspace-types"
import { pickPrimaryInstructorAssignment } from "@/lib/programs/primary-instructor"
import type { ProgramCapacityGroupInput } from "@/lib/programs/program-capacity-group-types"
import { PROGRAM_LABEL } from "@/lib/programs/program-display-labels"
import type { OfferingDeliveryFormat } from "@/lib/programs/program-offering-attributes"
import {
  deleteProgramOffering,
  updateProgramOffering,
} from "@/lib/programs/program-offering-actions"
import {
  type ProgramOffering,
  type ProgramOfferingStatus,
} from "@/lib/programs/program-offering-types"
import type { ProgramStaffAssignmentWithDetails } from "@/lib/programs/program-staff-assignment-types"
import type { Program } from "@/lib/programs/program-types"
import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"
import {
  normalizeProgramKind,
  type ProgramKind,
} from "@/lib/programs/program-kind"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS: ProgramOfferingStatus[] = ["draft", "active"]

const ADVANCED_OPEN_SECTIONS = [
  "staff",
  "schedule",
  "registration",
  "pricing",
  "questions",
]

function parseOptionalNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeGender(value: string | null | undefined): ProgramGender {
  if (value === "Male" || value === "Female" || value === "All") return value
  return "All"
}

function getPrimaryInstructorContactId(
  workspaceData: OfferingWorkspaceData
): string {
  return pickPrimaryInstructorAssignment(workspaceData.staffAssignments)
    ?.contact_id ?? ""
}

export function OfferingEditDialog({
  open,
  onOpenChange,
  program,
  offering: initialOffering,
  departmentId = null,
  departmentName = null,
  workspaceData: initialWorkspaceData,
  capacityGroups: initialCapacityGroups,
  summary,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  program: Program
  offering: ProgramOffering
  departmentId?: string | null
  departmentName?: string | null
  workspaceData: OfferingWorkspaceData
  capacityGroups: ProgramCapacityGroupInput[]
  summary: OfferingManageSummary
  onSaved: (
    updated: ProgramOffering,
    extras?: { staffAssignments?: ProgramStaffAssignmentWithDetails[] }
  ) => void
}) {
  const router = useRouter()
  const [offering, setOffering] = React.useState(initialOffering)
  const [workspaceData, setWorkspaceData] = React.useState(initialWorkspaceData)
  const [capacityGroups, setCapacityGroups] = React.useState(
    initialCapacityGroups
  )

  const [name, setName] = React.useState(initialOffering.name)
  const [programKind, setProgramKind] = React.useState<ProgramKind>(() =>
    normalizeProgramKind(program.program_kind)
  )
  const [deliveryFormat, setDeliveryFormat] =
    React.useState<OfferingDeliveryFormat>(
      initialOffering.delivery_format ?? "in_person"
    )
  const [status, setStatus] = React.useState<ProgramOfferingStatus>(
    initialOffering.status
  )
  const [startDate, setStartDate] = React.useState(
    initialOffering.start_date || ""
  )
  const [endDate, setEndDate] = React.useState(initialOffering.end_date || "")
  const [enrollmentOpenDate, setEnrollmentOpenDate] = React.useState(
    initialOffering.enrollment_open_date || ""
  )
  const [enrollmentCloseDate, setEnrollmentCloseDate] = React.useState(
    initialOffering.enrollment_close_date || ""
  )
  const [primaryInstructorId, setPrimaryInstructorId] = React.useState(() =>
    getPrimaryInstructorContactId(initialWorkspaceData)
  )
  const selectedInstructorIdRef = React.useRef(primaryInstructorId)
  const [gender, setGender] = React.useState<ProgramGender>(() =>
    normalizeGender(initialOffering.gender)
  )
  const [minAge, setMinAge] = React.useState<number | null>(
    initialOffering.min_age ?? null
  )
  const [maxAge, setMaxAge] = React.useState<number | null>(
    initialOffering.max_age ?? null
  )
  const [capacity, setCapacity] = React.useState(() =>
    initialOffering.capacity_mode === "limited" &&
    initialOffering.capacity != null
      ? String(initialOffering.capacity)
      : ""
  )
  const [openEnrollment, setOpenEnrollment] = React.useState(
    initialOffering.application_required === false
  )
  const [staffOptions, setStaffOptions] = React.useState<
    Array<{ id: string; full_name: string | null; email: string | null }>
  >([])
  const [advancedOpen, setAdvancedOpen] = React.useState(false)
  const [advancedEverOpened, setAdvancedEverOpened] = React.useState(false)
  const [registrationResetKey, setRegistrationResetKey] = React.useState(0)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const registrationSaveRef = React.useRef<(() => Promise<boolean>) | null>(
    null
  )
  const pricingSaveRef = React.useRef<(() => Promise<boolean>) | null>(null)
  const scheduleSaveRef = React.useRef<(() => Promise<boolean>) | null>(null)
  const staffSaveRef = React.useRef<(() => Promise<boolean>) | null>(null)
  const [questionsAccordionPortalTarget, setQuestionsAccordionPortalTarget] =
    React.useState<HTMLElement | null>(null)

  const resetFromProps = React.useCallback(() => {
    setOffering(initialOffering)
    setWorkspaceData(initialWorkspaceData)
    setCapacityGroups(initialCapacityGroups)
    setName(initialOffering.name)
    setProgramKind(normalizeProgramKind(program.program_kind))
    setDeliveryFormat(initialOffering.delivery_format ?? "in_person")
    setStatus(initialOffering.status)
    setStartDate(initialOffering.start_date || "")
    setEndDate(initialOffering.end_date || "")
    setEnrollmentOpenDate(initialOffering.enrollment_open_date || "")
    setEnrollmentCloseDate(initialOffering.enrollment_close_date || "")
    setPrimaryInstructorId(getPrimaryInstructorContactId(initialWorkspaceData))
    setGender(normalizeGender(initialOffering.gender))
    setMinAge(initialOffering.min_age ?? null)
    setMaxAge(initialOffering.max_age ?? null)
    setCapacity(
      initialOffering.capacity_mode === "limited" &&
        initialOffering.capacity != null
        ? String(initialOffering.capacity)
        : ""
    )
    setOpenEnrollment(initialOffering.application_required === false)
    setAdvancedOpen(false)
    setAdvancedEverOpened(false)
    setError(null)
    setRegistrationResetKey((key) => key + 1)
    selectedInstructorIdRef.current = getPrimaryInstructorContactId(
      initialWorkspaceData
    )
  }, [initialOffering, initialWorkspaceData, initialCapacityGroups, program.program_kind])

  const resetFromPropsRef = React.useRef(resetFromProps)
  resetFromPropsRef.current = resetFromProps

  React.useEffect(() => {
    if (!open) return
    resetFromPropsRef.current()
  }, [open])

  React.useEffect(() => {
    if (!open) return
    void (async () => {
      try {
        const { searchProgramStaffContactsAction } = await import(
          "@/lib/programs/program-staff-assignment-actions"
        )
        const rows = await searchProgramStaffContactsAction("", {
          departmentId,
        })
        setStaffOptions(
          (rows || []).map((row) => ({
            id: row.id,
            full_name: row.full_name ?? null,
            email: row.email ?? null,
          }))
        )
      } catch {
        setStaffOptions([])
      }
    })()
  }, [open, departmentId])

  function buildEligibilityAttributes() {
    const capacityValue = parseOptionalNumber(capacity)
    const limited = capacityValue != null && capacityValue > 0
    return {
      gender,
      min_age: minAge,
      max_age: maxAge,
      audience_type:
        minAge != null && minAge >= ADULT_MIN_AGE
          ? ("adult" as const)
          : ("youth" as const),
      capacity_mode: limited ? ("limited" as const) : ("unlimited" as const),
      capacity: limited ? capacityValue : null,
      application_required: !openEnrollment,
      delivery_format: deliveryFormat,
    }
  }

  const instructorOptions = React.useMemo(() => {
    const byId = new Map(staffOptions.map((row) => [row.id, row]))
    const assignedId = getPrimaryInstructorContactId(workspaceData)
    if (assignedId && !byId.has(assignedId)) {
      const assignment = workspaceData.staffAssignments.find(
        (row) => row.contact_id === assignedId
      )
      byId.set(assignedId, {
        id: assignedId,
        full_name: assignment?.contact_name ?? "Current instructor",
        email: assignment?.contact_email ?? null,
      })
    }
    if (primaryInstructorId && !byId.has(primaryInstructorId)) {
      byId.set(primaryInstructorId, {
        id: primaryInstructorId,
        full_name: "Selected instructor",
        email: null,
      })
    }
    return Array.from(byId.values())
  }, [staffOptions, workspaceData, primaryInstructorId])

  async function persistPrimaryInstructor() {
    const { setOfferingPrimaryInstructor } = await import(
      "@/lib/programs/program-staff-assignment-actions"
    )
    return setOfferingPrimaryInstructor({
      programId: program.id,
      offeringId: offering.id,
      contactId: selectedInstructorIdRef.current || null,
    })
  }

  async function handleSave() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Name is required.")
      return
    }
    if (minAge != null && maxAge != null && minAge > maxAge) {
      setError("Minimum age cannot be greater than maximum age.")
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const eligibility = buildEligibilityAttributes()
      const updated = (await updateProgramOffering(offering.id, {
        name: trimmedName,
        offering_type: offering.offering_type,
        start_date: startDate || null,
        end_date: endDate || null,
        enrollment_open_date: enrollmentOpenDate || null,
        enrollment_close_date: enrollmentCloseDate || null,
        status,
        flyer_url: offering.flyer_url ?? null,
        background_color: offering.background_color ?? null,
        inherit_dates: false,
        inherit_eligibility: false,
        inherit_enrollment: offering.inherit_enrollment,
        attributes: eligibility,
      })) as ProgramOffering

      if (programKind !== normalizeProgramKind(program.program_kind)) {
        const { updateProgramKind } = await import(
          "@/lib/programs/program-actions"
        )
        await updateProgramKind({
          id: program.id,
          program_kind: programKind,
          department_id: departmentId ?? program.department_id ?? null,
        })
      }

      const nextAssignments = await persistPrimaryInstructor()

      if (advancedEverOpened) {
        if (staffSaveRef.current) {
          const staffOk = await staffSaveRef.current()
          if (!staffOk) return
        }
        if (scheduleSaveRef.current) {
          const scheduleOk = await scheduleSaveRef.current()
          if (!scheduleOk) return
        }
        if (registrationSaveRef.current) {
          const registrationOk = await registrationSaveRef.current()
          if (!registrationOk) return
        }
        if (pricingSaveRef.current) {
          const pricingOk = await pricingSaveRef.current()
          if (!pricingOk) return
        }
      }

      setOffering(updated)
      setWorkspaceData((current) => ({
        ...current,
        staffAssignments: nextAssignments,
      }))
      onSaved(updated, { staffAssignments: nextAssignments })
      onOpenChange(false)
      router.refresh()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : `Failed to save ${PROGRAM_LABEL.toLowerCase()}.`
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!summary.canDelete) return
    setIsDeleting(true)
    setError(null)
    try {
      await deleteProgramOffering(offering.id)
      onOpenChange(false)
      router.refresh()
      router.push(programWorkspaceHref(program.id, { tab: "offerings" }))
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : `Failed to delete ${PROGRAM_LABEL.toLowerCase()}.`
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const basicFieldOverrides = {
    enrollmentOpenDate,
    enrollmentCloseDate,
    gender,
    minAge,
    maxAge,
    capacity: parseOptionalNumber(capacity) ?? 0,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 space-y-1.5 border-b px-6 py-4 text-left">
          <DialogTitle>Edit offering</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <OfferingBasicsForm
            mode="edit"
            disabled={isSaving || isDeleting}
            departmentId={departmentId}
            departmentName={departmentName}
            staffOptions={instructorOptions}
            statusOptions={
              status === "closed"
                ? (["draft", "active", "closed"] as ProgramOfferingStatus[])
                : status === "cancelled"
                  ? (["cancelled", "draft", "active"] as ProgramOfferingStatus[])
                  : STATUS_OPTIONS
            }
            kindRadioName="edit-offering-kind"
            values={{
              kind: programKind,
              name,
              deliveryFormat,
              status,
              startDate,
              endDate,
              enrollmentOpenDate,
              enrollmentCloseDate,
              primaryInstructorId,
              gender,
              minAge,
              maxAge,
              capacity,
            }}
            onChange={(patch) => {
              if (patch.kind !== undefined) setProgramKind(patch.kind)
              if (patch.name !== undefined) setName(patch.name)
              if (patch.deliveryFormat !== undefined) {
                setDeliveryFormat(patch.deliveryFormat)
              }
              if (patch.status !== undefined) setStatus(patch.status)
              if (patch.startDate !== undefined) setStartDate(patch.startDate)
              if (patch.endDate !== undefined) setEndDate(patch.endDate)
              if (patch.enrollmentOpenDate !== undefined) {
                setEnrollmentOpenDate(patch.enrollmentOpenDate)
              }
              if (patch.enrollmentCloseDate !== undefined) {
                setEnrollmentCloseDate(patch.enrollmentCloseDate)
              }
              if (patch.primaryInstructorId !== undefined) {
                selectedInstructorIdRef.current = patch.primaryInstructorId
                setPrimaryInstructorId(patch.primaryInstructorId)
              }
              if (patch.gender !== undefined) setGender(patch.gender)
              if (patch.minAge !== undefined) setMinAge(patch.minAge)
              if (patch.maxAge !== undefined) setMaxAge(patch.maxAge)
              if (patch.capacity !== undefined) setCapacity(patch.capacity)
            }}
          />

          <Collapsible
            open={advancedOpen}
            onOpenChange={(next) => {
              setAdvancedOpen(next)
              if (next) setAdvancedEverOpened(true)
            }}
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/40"
              >
                Advanced Settings
                {advancedOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <Accordion
                type="multiple"
                defaultValue={ADVANCED_OPEN_SECTIONS}
                className="space-y-3"
              >
                <OfferingSettingsAccordionItem
                  value="staff"
                  title="Additional Staff"
                >
                  <OfferingOverviewStaffFields
                    programId={program.id}
                    offering={offering}
                    assignments={workspaceData.staffAssignments}
                    sessions={workspaceData.sessions}
                    editing
                    departmentId={departmentId}
                    variant="additionalInline"
                    saveHandlerRef={staffSaveRef}
                    disabled={isSaving || isDeleting}
                    onAssignmentsChange={(assignments) => {
                      setWorkspaceData((current) => ({
                        ...current,
                        staffAssignments: assignments,
                      }))
                    }}
                  />
                </OfferingSettingsAccordionItem>

                <OfferingSettingsAccordionItem
                  value="schedule"
                  title="Schedule"
                >
                  <OfferingSchedulePanel
                    programId={program.id}
                    offering={offering}
                    workspaceData={workspaceData}
                    variant="simple"
                    saveHandlerRef={scheduleSaveRef}
                    disabled={isSaving || isDeleting}
                  />
                </OfferingSettingsAccordionItem>

                <OfferingRegistrationPanel
                  key={`${offering.id}-${registrationResetKey}`}
                  program={program}
                  offering={offering}
                  workspaceData={workspaceData}
                  capacityGroups={capacityGroups}
                  enrolled={summary.enrolled}
                  onCapacityGroupsChange={setCapacityGroups}
                  onRegistrationOptionsSaved={(_, registrationOptions) => {
                    setWorkspaceData((current) => ({
                      ...current,
                      registrationOptions,
                    }))
                  }}
                  showSaveButton={false}
                  saveHandlerRef={registrationSaveRef}
                  settingsSplit
                  omitBasicFields
                  basicFieldOverrides={basicFieldOverrides}
                  questionsAccordionPortalTarget={questionsAccordionPortalTarget}
                  onSessionsChange={(sessions) => {
                    setWorkspaceData((current) => ({
                      ...current,
                      sessions,
                    }))
                  }}
                />

                <OfferingSettingsAccordionItem
                  value="pricing"
                  title="Pricing"
                >
                  <OfferingPricingProvider
                    programId={program.id}
                    offering={offering}
                    workspaceData={workspaceData}
                    registrationOptions={workspaceData.registrationOptions}
                    programKind={program.program_kind}
                    saveHandlerRef={pricingSaveRef}
                  >
                    <OfferingPricingPanel
                      programId={program.id}
                      offering={offering}
                      workspaceData={workspaceData}
                      registrationOptions={workspaceData.registrationOptions}
                      programKind={program.program_kind}
                      showSaveButton={false}
                      showTitle={false}
                      showPaymentStructure={false}
                      showBillingSchedule
                      split
                    />
                  </OfferingPricingProvider>
                </OfferingSettingsAccordionItem>

                <div
                  ref={setQuestionsAccordionPortalTarget}
                  className="contents"
                />
              </Accordion>
            </CollapsibleContent>
          </Collapsible>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4 sm:justify-between">
          <div className="mr-auto">
            {summary.canDelete ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={isSaving || isDeleting}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {offering.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes the{" "}
                      {PROGRAM_LABEL.toLowerCase()}, its registration options,
                      and linked pricing setup. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={isDeleting}
                      onClick={(event) => {
                        event.preventDefault()
                        void handleDelete()
                      }}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Deleting…
                        </>
                      ) : (
                        `Delete ${PROGRAM_LABEL.toLowerCase()}`
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <p
                className={cn(
                  "max-w-xs text-xs text-muted-foreground",
                  "hidden sm:block"
                )}
              >
                Delete unavailable while this{" "}
                {PROGRAM_LABEL.toLowerCase()} has applications, registrations,
                or payments.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving || isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-sky-600 hover:bg-sky-700"
              onClick={() => void handleSave()}
              disabled={isSaving || isDeleting || !name.trim()}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

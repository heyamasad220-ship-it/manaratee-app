"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Copy, Pencil, Plus, Trash2 } from "lucide-react"

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { OfferingWorkspace } from "@/components/programs/edit/offering-workspace"
import { Badge } from "@/components/ui/badge"
import { buildCopyName } from "@/lib/programs/program-fee-plan-copy-utils"
import { duplicateProgramOffering } from "@/lib/programs/program-offering-duplicate-actions"
import {
  createProgramOffering,
  deleteProgramOffering,
  updateProgramOffering,
} from "@/lib/programs/program-offering-actions"
import {
  formatOfferingDateRange,
  isLegacyDefaultOfferingName,
  isOfferingEnrollmentOpen,
} from "@/lib/programs/program-offering-display"
import type {
  ProgramOffering,
  ProgramOfferingInput,
  ProgramOfferingStatus,
} from "@/lib/programs/program-offering-types"
import { PROGRAM_OFFERING_STATUS_LABELS } from "@/lib/programs/program-offering-types"
import { loadOfferingWorkspaceDataForProgramAction } from "@/lib/programs/offering-workspace-actions"
import type { OfferingWorkspaceDataMap } from "@/lib/programs/offering-workspace-types"
import type { ProgramCapacityGroupInput } from "@/lib/programs/program-capacity-group-types"
import type { ProgramRegistrationOption } from "@/lib/programs/program-registration-option-types"
import type { ProgramStaffAssignmentWithDetails } from "@/lib/programs/program-staff-assignment-types"
import type { Program } from "@/lib/programs/program-types"
import { cn } from "@/lib/utils"

import { EditSectionCard } from "./edit-section-card"

function emptyDraft(program: Program): ProgramOfferingInput {
  return {
    name: "",
    offering_type: "standard",
    start_date: program.start_date,
    end_date: program.end_date,
    enrollment_open_date: program.enrollment_open_date,
    enrollment_close_date: program.enrollment_close_date,
    status: program.status === "draft" ? "draft" : "active",
  }
}

function offeringToDraft(offering: ProgramOffering): ProgramOfferingInput {
  return {
    name: offering.name,
    offering_type: offering.offering_type,
    start_date: offering.start_date,
    end_date: offering.end_date,
    enrollment_open_date: offering.enrollment_open_date,
    enrollment_close_date: offering.enrollment_close_date,
    status: offering.status,
  }
}

function getStatusBadgeVariant(status: ProgramOfferingStatus) {
  switch (status) {
    case "active":
      return "default" as const
    case "closed":
      return "outline" as const
    case "archived":
      return "secondary" as const
    default:
      return "secondary" as const
  }
}

function resolveOfferingFromParam(
  offerings: ProgramOffering[],
  offeringParam: string | null
) {
  if (offeringParam && offerings.some((item) => item.id === offeringParam)) {
    return offerings.find((item) => item.id === offeringParam) ?? null
  }

  return offerings[0] ?? null
}

export function ProgramOfferingsSection({
  program,
  offerings: initialOfferings,
  workspaceDataMap: initialWorkspaceDataMap,
  capacityGroups,
  onCapacityGroupsChange,
}: {
  program: Program
  offerings: ProgramOffering[]
  workspaceDataMap: OfferingWorkspaceDataMap
  capacityGroups: ProgramCapacityGroupInput[]
  onCapacityGroupsChange: (groups: ProgramCapacityGroupInput[]) => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const offeringParam = searchParams.get("offering")
  const workspaceTabParam = searchParams.get("workspaceTab")
  const initialOffering = resolveOfferingFromParam(
    initialOfferings,
    offeringParam
  )

  const [offerings, setOfferings] = React.useState(initialOfferings)
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialOffering?.id ?? null
  )
  const [isCreating, setIsCreating] = React.useState(false)
  const [draft, setDraft] = React.useState<ProgramOfferingInput>(() =>
    initialOffering ? offeringToDraft(initialOffering) : emptyDraft(program)
  )
  const [savedDraft, setSavedDraft] = React.useState<ProgramOfferingInput>(() =>
    initialOffering ? offeringToDraft(initialOffering) : emptyDraft(program)
  )
  const [showArchived, setShowArchived] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [duplicateTarget, setDuplicateTarget] =
    React.useState<ProgramOffering | null>(null)
  const [duplicateName, setDuplicateName] = React.useState("")
  const [isDuplicating, setIsDuplicating] = React.useState(false)
  const [workspaceDataMap, setWorkspaceDataMap] =
    React.useState(initialWorkspaceDataMap)
  const [workspaceLoading, setWorkspaceLoading] = React.useState(
    Object.keys(initialWorkspaceDataMap).length === 0 && initialOfferings.length > 0
  )
  const workspaceLoadedRef = React.useRef(
    Object.keys(initialWorkspaceDataMap).length > 0
  )

  React.useEffect(() => {
    if (Object.keys(initialWorkspaceDataMap).length === 0) {
      return
    }

    setWorkspaceDataMap(initialWorkspaceDataMap)
    workspaceLoadedRef.current = true
    setWorkspaceLoading(false)
  }, [initialWorkspaceDataMap])

  React.useEffect(() => {
    if (workspaceLoadedRef.current || initialOfferings.length === 0) {
      return
    }

    let cancelled = false
    setWorkspaceLoading(true)

    void loadOfferingWorkspaceDataForProgramAction(program.id)
      .then((data) => {
        if (cancelled) return
        setWorkspaceDataMap(data)
        workspaceLoadedRef.current = true
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load offering details."
        )
      })
      .finally(() => {
        if (!cancelled) {
          setWorkspaceLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [program.id, initialOfferings.length])

  const handleRegistrationOptionsSaved = React.useCallback(
    (offeringId: string, registrationOptions: ProgramRegistrationOption[]) => {
      setWorkspaceDataMap((current) => {
        const existing = current[offeringId]
        if (!existing) {
          return current
        }

        return {
          ...current,
          [offeringId]: {
            ...existing,
            registrationOptions,
          },
        }
      })
    },
    []
  )

  const handleStaffAssignmentsChange = React.useCallback(
    (
      offeringId: string,
      staffAssignments: ProgramStaffAssignmentWithDetails[]
    ) => {
      setWorkspaceDataMap((current) => {
        const existing = current[offeringId]
        if (!existing) {
          return current
        }

        return {
          ...current,
          [offeringId]: {
            ...existing,
            staffAssignments,
          },
        }
      })
    },
    []
  )

  const offeringsSignature = React.useMemo(
    () =>
      initialOfferings
        .map(
          (offering) =>
            `${offering.id}:${offering.updated_at ?? ""}:${offering.name}:${offering.status}`
        )
        .join("|"),
    [initialOfferings]
  )

  React.useEffect(() => {
    setOfferings(initialOfferings)
    // Sync from server when offering rows actually change, not on array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tracked via offeringsSignature
  }, [offeringsSignature])

  React.useEffect(() => {
    const offering = resolveOfferingFromParam(offerings, offeringParam)
    if (!offering || offering.id === selectedId) {
      return
    }

    setIsCreating(false)
    setSelectedId(offering.id)
    const nextDraft = offeringToDraft(offering)
    setDraft(nextDraft)
    setSavedDraft(nextDraft)
  }, [offeringParam, offerings, selectedId])

  const visibleOfferings = React.useMemo(
    () =>
      showArchived
        ? offerings
        : offerings.filter((offering) => offering.status !== "archived"),
    [offerings, showArchived]
  )

  const selectedOffering =
    offerings.find((offering) => offering.id === selectedId) ?? null

  const showLegacyBanner =
    offerings.length === 1 &&
    offerings[0]?.is_default &&
    isLegacyDefaultOfferingName(offerings[0].name)

  const activeCount = offerings.filter(
    (offering) => offering.status === "active"
  ).length

  function selectOffering(offering: ProgramOffering) {
    setIsCreating(false)
    setSelectedId(offering.id)
    const nextDraft = offeringToDraft(offering)
    setDraft(nextDraft)
    setSavedDraft(nextDraft)
    setError(null)
  }

  function startCreate() {
    setIsCreating(true)
    setSelectedId(null)
    const nextDraft = emptyDraft(program)
    setDraft(nextDraft)
    setSavedDraft(nextDraft)
    setError(null)
  }

  async function handleSaveOverview(): Promise<boolean> {
    setIsSaving(true)
    setError(null)

    try {
      if (isCreating) {
        const created = await createProgramOffering(
          program.id,
          draft,
          program.organization_id
        )
        const nextOffering = created as ProgramOffering
        setOfferings((current) => [...current, nextOffering])
        setIsCreating(false)
        setSelectedId(nextOffering.id)
        const nextDraft = offeringToDraft(nextOffering)
        setDraft(nextDraft)
        setSavedDraft(nextDraft)
      } else if (selectedId) {
        const updated = await updateProgramOffering(selectedId, draft)
        const nextOffering = updated as ProgramOffering
        setOfferings((current) =>
          current.map((offering) =>
            offering.id === selectedId ? nextOffering : offering
          )
        )
        const nextDraft = offeringToDraft(nextOffering)
        setDraft(nextDraft)
        setSavedDraft(nextDraft)
      }

      router.refresh()
      return true
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save offering"
      )
      return false
    } finally {
      setIsSaving(false)
    }
  }

  function openDuplicateDialog(offering: ProgramOffering) {
    setDuplicateTarget(offering)
    setDuplicateName(buildCopyName(offering.name))
    setError(null)
  }

  function closeDuplicateDialog() {
    if (isDuplicating) {
      return
    }

    setDuplicateTarget(null)
    setDuplicateName("")
  }

  async function handleDuplicate() {
    if (!duplicateTarget) {
      return
    }

    const name = duplicateName.trim()
    if (!name) {
      setError("Offering name is required")
      return
    }

    setIsDuplicating(true)
    setError(null)

    try {
      const created = await duplicateProgramOffering(duplicateTarget.id, name)
      const nextOffering = created as ProgramOffering

      setOfferings((current) => [...current, nextOffering])
      setIsCreating(false)
      setSelectedId(nextOffering.id)
      const nextDraft = offeringToDraft(nextOffering)
      setDraft(nextDraft)
      setSavedDraft(nextDraft)
      setDuplicateTarget(null)
      setDuplicateName("")
      router.refresh()
    } catch (duplicateError) {
      setError(
        duplicateError instanceof Error
          ? duplicateError.message
          : "Failed to duplicate offering"
      )
    } finally {
      setIsDuplicating(false)
    }
  }

  async function handleDelete(offeringId: string) {
    const offering = offerings.find((item) => item.id === offeringId)

    if (!offering || offering.is_default) {
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await deleteProgramOffering(offeringId)
      const nextOfferings = offerings.filter((item) => item.id !== offeringId)
      setOfferings(nextOfferings)

      if (selectedId === offeringId) {
        setSelectedId(nextOfferings[0]?.id ?? null)
        setIsCreating(false)
        const nextDraft = nextOfferings[0]
          ? offeringToDraft(nextOfferings[0])
          : emptyDraft(program)
        setDraft(nextDraft)
        setSavedDraft(nextDraft)
      }

      router.refresh()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete offering"
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <EditSectionCard
      title="Offerings"
      description="Select an offering to manage registration, pricing, sessions, and more — all in one place."
    >
      <div className="space-y-4">
        {showLegacyBanner ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            This program uses a single default offering. Rename it (for example,
            &quot;Beginner ESL&quot; or &quot;June Camp&quot;) or add more
            offerings below.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {offerings.length} offering{offerings.length === 1 ? "" : "s"} ·{" "}
              {activeCount} active
            </p>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={showArchived}
                onCheckedChange={(checked) => setShowArchived(checked === true)}
              />
              Show archived offerings
            </label>
          </div>
          <Button type="button" size="sm" onClick={startCreate}>
            <Plus className="mr-1 h-4 w-4" />
            Add offering
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(220px,34%)_minmax(0,1fr)]">
          <div className="space-y-2 rounded-lg border p-2">
            {visibleOfferings.length === 0 ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">
                {offerings.length === 0
                  ? "No offerings yet. Add the first offering customers can register for."
                  : "No visible offerings. Turn on archived offerings or add a new one."}
              </p>
            ) : (
              visibleOfferings.map((offering) => {
                const enrollmentOpen = isOfferingEnrollmentOpen(offering, program)

                return (
                  <div
                    key={offering.id}
                    className={cn(
                      "rounded-md border px-2 py-2 transition-colors",
                      selectedId === offering.id && !isCreating
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:bg-muted/60",
                      offering.status === "archived" && "opacity-70"
                    )}
                  >
                    <div className="flex items-start gap-1">
                      <button
                        type="button"
                        onClick={() => selectOffering(offering)}
                        className="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {offering.name}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatOfferingDateRange(
                                offering.start_date,
                                offering.end_date
                              )}
                            </p>
                          </div>
                          <Badge
                            variant={getStatusBadgeVariant(offering.status)}
                            className="shrink-0 text-[10px]"
                          >
                            {PROGRAM_OFFERING_STATUS_LABELS[offering.status]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {offering.status === "archived"
                            ? "Hidden from customers"
                            : enrollmentOpen
                              ? "Registration open"
                              : "Not open"}
                          {offering.is_default ? " · Default" : ""}
                        </p>
                      </button>

                      <div className="flex shrink-0 items-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openDuplicateDialog(offering)}
                          disabled={isSaving || isDuplicating}
                          aria-label={`Duplicate ${offering.name}`}
                          title="Duplicate offering"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => selectOffering(offering)}
                          disabled={isSaving}
                          aria-label={`Edit ${offering.name}`}
                          title="Edit offering"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        {!offering.is_default ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                disabled={isSaving}
                                aria-label={`Delete ${offering.name}`}
                                title="Delete offering"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete {offering.name}?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently removes the offering, its
                                  registration options, and linked pricing setup.
                                  Offerings with registrations cannot be deleted
                                  — use Archived instead.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => void handleDelete(offering.id)}
                                >
                                  Delete offering
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="rounded-lg border p-4">
            {workspaceLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading offering details…
              </div>
            ) : (
              <OfferingWorkspace
                program={program}
                offering={selectedOffering}
                isCreating={isCreating}
                draft={draft}
                savedDraft={savedDraft}
                onDraftChange={setDraft}
                onSaveOverview={handleSaveOverview}
                onDelete={handleDelete}
                isSaving={isSaving}
                error={error}
                workspaceDataMap={workspaceDataMap}
                capacityGroups={capacityGroups}
                onCapacityGroupsChange={onCapacityGroupsChange}
                onRegistrationOptionsSaved={handleRegistrationOptionsSaved}
                onStaffAssignmentsChange={handleStaffAssignmentsChange}
                initialWorkspaceTab={
                  workspaceTabParam === "registration" ||
                  workspaceTabParam === "pricing" ||
                  workspaceTabParam === "sessions" ||
                  workspaceTabParam === "staff" ||
                  workspaceTabParam === "schedule" ||
                  workspaceTabParam === "overview"
                    ? workspaceTabParam
                    : undefined
                }
              />
            )}
          </div>
        </div>

        <Dialog
          open={duplicateTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              closeDuplicateDialog()
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Duplicate offering</DialogTitle>
              <DialogDescription>
                Copy registration options, pricing, sessions, and billing schedule
                from {duplicateTarget?.name}. Program-level settings such as
                eligibility and capacity groups stay shared.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="duplicate-offering-name">New offering name</Label>
              <Input
                id="duplicate-offering-name"
                value={duplicateName}
                onChange={(event) => setDuplicateName(event.target.value)}
                placeholder="Summer Camp (July)"
                disabled={isDuplicating}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void handleDuplicate()
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDuplicateDialog}
                disabled={isDuplicating}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleDuplicate()}
                disabled={isDuplicating || !duplicateName.trim()}
              >
                {isDuplicating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Duplicating…
                  </>
                ) : (
                  "Duplicate offering"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </EditSectionCard>
  )
}

"use client"

import * as React from "react"
import { Loader2, Trash2 } from "lucide-react"

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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OfferingPricingPanel } from "@/components/programs/edit/offering-pricing-panel"
import { OfferingRegistrationPanel } from "@/components/programs/edit/offering-registration-panel"
import { OfferingStaffPanel } from "@/components/programs/edit/offering-staff-panel"
import {
  OfferingSchedulePanel,
  OfferingSessionsPanel,
} from "@/components/programs/edit/offering-workspace-panels"
import type { OfferingWorkspaceDataMap } from "@/lib/programs/offering-workspace-types"
import type { ProgramCapacityGroupInput } from "@/lib/programs/program-capacity-group-types"
import {
  isSessionManagementEnabled,
  type ProgramRegistrationOption,
} from "@/lib/programs/program-registration-option-types"
import type {
  ProgramOffering,
  ProgramOfferingInput,
  ProgramOfferingStatus,
} from "@/lib/programs/program-offering-types"
import { PROGRAM_OFFERING_STATUS_LABELS } from "@/lib/programs/program-offering-types"
import type { Program } from "@/lib/programs/program-types"
import type { ProgramStaffAssignmentWithDetails } from "@/lib/programs/program-staff-assignment-types"

const OFFERING_TYPE_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "academic_year", label: "Academic year" },
  { value: "summer", label: "Summer" },
  { value: "season", label: "Season" },
  { value: "recurring", label: "Recurring" },
] as const

const STATUS_OPTIONS: ProgramOfferingStatus[] = [
  "draft",
  "active",
  "closed",
  "archived",
]

const WORKSPACE_TABS = [
  { value: "overview", label: "Overview" },
  { value: "registration", label: "Registration" },
  { value: "pricing", label: "Pricing" },
  { value: "sessions", label: "Sessions" },
  { value: "staff", label: "Instructors & Staff" },
  { value: "schedule", label: "Schedule" },
] as const

type WorkspaceTab = (typeof WORKSPACE_TABS)[number]["value"]

function getNextWorkspaceTab(tab: WorkspaceTab): WorkspaceTab | null {
  const index = WORKSPACE_TABS.findIndex((item) => item.value === tab)
  if (index < 0 || index >= WORKSPACE_TABS.length - 1) {
    return null
  }

  return WORKSPACE_TABS[index + 1]?.value ?? null
}

function preventFormSubmitOnEnter(event: React.KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault()
  }
}

export function OfferingWorkspace({
  program,
  offering,
  isCreating,
  draft,
  savedDraft,
  onDraftChange,
  onSaveOverview,
  onDelete,
  isSaving,
  error,
  workspaceDataMap,
  capacityGroups,
  onCapacityGroupsChange,
  onRegistrationOptionsSaved,
  onStaffAssignmentsChange,
  initialWorkspaceTab,
}: {
  program: Program
  offering: ProgramOffering | null
  isCreating: boolean
  draft: ProgramOfferingInput
  savedDraft: ProgramOfferingInput
  onDraftChange: (draft: ProgramOfferingInput) => void
  onSaveOverview: () => Promise<boolean>
  onDelete: (offeringId: string) => Promise<void>
  isSaving: boolean
  error: string | null
  workspaceDataMap: OfferingWorkspaceDataMap
  capacityGroups: ProgramCapacityGroupInput[]
  onCapacityGroupsChange: (groups: ProgramCapacityGroupInput[]) => void
  onRegistrationOptionsSaved?: (
    offeringId: string,
    registrationOptions: ProgramRegistrationOption[]
  ) => void
  onStaffAssignmentsChange?: (
    offeringId: string,
    staffAssignments: ProgramStaffAssignmentWithDetails[]
  ) => void
  initialWorkspaceTab?: WorkspaceTab
}) {
  const [activeTab, setActiveTab] = React.useState<WorkspaceTab>(
    initialWorkspaceTab ?? "overview"
  )

  const goToNextTab = React.useCallback(() => {
    const nextTab = getNextWorkspaceTab(activeTab)
    if (nextTab) {
      setActiveTab(nextTab)
    }
  }, [activeTab])

  async function handleOverviewNext() {
    const saved = await onSaveOverview()
    if (saved) {
      goToNextTab()
    }
  }

  React.useEffect(() => {
    setActiveTab(initialWorkspaceTab ?? "overview")
  }, [offering?.id, initialWorkspaceTab])

  const hasUnsavedOverview =
    isCreating ||
    draft.name !== savedDraft.name ||
    draft.offering_type !== savedDraft.offering_type ||
    draft.status !== savedDraft.status ||
    (draft.start_date ?? "") !== (savedDraft.start_date ?? "") ||
    (draft.end_date ?? "") !== (savedDraft.end_date ?? "")

  const workspaceData = offering ? workspaceDataMap[offering.id] : null

  const sessionRegistrationEnabled =
    workspaceData?.registrationOptions
      ? isSessionManagementEnabled(workspaceData.registrationOptions)
      : false

  if (!isCreating && !offering) {
    return (
      <p className="text-sm text-muted-foreground">
        Select an offering from the list or add a new one.
      </p>
    )
  }

  if (isCreating) {
    return (
      <div className="space-y-4" onKeyDown={preventFormSubmitOnEnter}>
        <div>
          <h3 className="text-sm font-semibold">New offering</h3>
          <p className="text-xs text-muted-foreground">
            Create the offering first, then configure registration, pricing, and
            sessions.
          </p>
        </div>
        <OfferingOverviewFields draft={draft} onDraftChange={onDraftChange} />
        {error ? <WorkspaceError message={error} /> : null}
        <OverviewFooter
          isCreating
          isSaving={isSaving}
          canSave={Boolean(draft.name.trim())}
          onNext={() => void handleOverviewNext()}
          offering={null}
          onDelete={onDelete}
        />
      </div>
    )
  }

  if (!offering || !workspaceData) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading offering workspace…
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{offering.name}</h3>
        <p className="text-xs text-muted-foreground">
          {offering.is_default
            ? "Default offering · manage all settings below"
            : "Manage registration, pricing, sessions, and more for this offering"}
        </p>
        {hasUnsavedOverview && activeTab === "overview" ? (
          <p className="mt-1 text-xs text-amber-700">Unsaved overview changes</p>
        ) : null}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as WorkspaceTab)}
        className="gap-3"
      >
        <TabsList>
          {WORKSPACE_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-4">
          <div onKeyDown={preventFormSubmitOnEnter}>
            <OfferingOverviewFields draft={draft} onDraftChange={onDraftChange} />
            {error ? <WorkspaceError message={error} /> : null}
            <OverviewFooter
              isCreating={false}
              isSaving={isSaving}
              canSave={Boolean(draft.name.trim())}
              onNext={() => void handleOverviewNext()}
              offering={offering}
              onDelete={onDelete}
            />
          </div>
        </TabsContent>

        <TabsContent value="registration" className="mt-0">
          <OfferingRegistrationPanel
            program={program}
            offering={offering}
            workspaceData={workspaceData}
            capacityGroups={capacityGroups}
            onCapacityGroupsChange={onCapacityGroupsChange}
            onRegistrationOptionsSaved={onRegistrationOptionsSaved}
            onNavigateNext={goToNextTab}
          />
        </TabsContent>

        <TabsContent value="pricing" className="mt-0">
          <OfferingPricingPanel
            programId={program.id}
            offering={offering}
            workspaceData={workspaceData}
            registrationOptions={workspaceData.registrationOptions}
            onNavigateNext={goToNextTab}
          />
        </TabsContent>

        <TabsContent value="sessions" className="mt-0 space-y-4">
          <OfferingSessionsPanel
            programId={program.id}
            offering={offering}
            workspaceData={workspaceData}
            sessionRegistrationEnabled={sessionRegistrationEnabled}
          />
          <WorkspaceTabNextFooter onNext={goToNextTab} />
        </TabsContent>

        <TabsContent value="staff" className="mt-0 space-y-4">
          <OfferingStaffPanel
            programId={program.id}
            offering={offering}
            assignments={workspaceData.staffAssignments}
            sessions={workspaceData.sessions}
            onAssignmentsChange={(assignments) =>
              onStaffAssignmentsChange?.(offering.id, assignments)
            }
          />
          <WorkspaceTabNextFooter onNext={goToNextTab} />
        </TabsContent>

        <TabsContent value="schedule" className="mt-0">
          <OfferingSchedulePanel
            programId={program.id}
            offering={offering}
            workspaceData={workspaceData}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function OfferingOverviewFields({
  draft,
  onDraftChange,
}: {
  draft: ProgramOfferingInput
  onDraftChange: (draft: ProgramOfferingInput) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="offering-name">Name</Label>
        <Input
          id="offering-name"
          value={draft.name}
          onChange={(event) =>
            onDraftChange({ ...draft, name: event.target.value })
          }
          placeholder="Beginner ESL, June Camp, Piano Level 1"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="offering-type">Type</Label>
        <select
          id="offering-type"
          value={draft.offering_type ?? "standard"}
          onChange={(event) =>
            onDraftChange({
              ...draft,
              offering_type: event.target
                .value as ProgramOfferingInput["offering_type"],
            })
          }
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
          {OFFERING_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="offering-status">Status</Label>
        <select
          id="offering-status"
          value={draft.status ?? "draft"}
          onChange={(event) =>
            onDraftChange({
              ...draft,
              status: event.target.value as ProgramOfferingStatus,
            })
          }
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {PROGRAM_OFFERING_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Use Archived to hide from customers without deleting.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="offering-start">Start date</Label>
        <Input
          id="offering-start"
          type="date"
          value={draft.start_date ?? ""}
          onChange={(event) =>
            onDraftChange({
              ...draft,
              start_date: event.target.value || null,
            })
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="offering-end">End date</Label>
        <Input
          id="offering-end"
          type="date"
          value={draft.end_date ?? ""}
          onChange={(event) =>
            onDraftChange({
              ...draft,
              end_date: event.target.value || null,
            })
          }
        />
      </div>
    </div>
  )
}

function WorkspaceError({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  )
}

function OverviewFooter({
  isCreating,
  isSaving,
  canSave,
  onNext,
  offering,
  onDelete,
}: {
  isCreating: boolean
  isSaving: boolean
  canSave: boolean
  onNext: () => void
  offering: ProgramOffering | null
  onDelete: (offeringId: string) => Promise<void>
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
      <div>
        {offering && !offering.is_default ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={isSaving}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {offering.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the offering, its registration
                  options, and linked pricing setup. Offerings with registrations
                  cannot be deleted — use Archived instead.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => void onDelete(offering.id)}
                >
                  Delete offering
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
      <Button type="button" onClick={onNext} disabled={isSaving || !canSave}>
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : isCreating ? (
          "Create offering"
        ) : (
          "Next"
        )}
      </Button>
    </div>
  )
}

function WorkspaceTabNextFooter({
  isSaving = false,
  disabled = false,
  onNext,
}: {
  isSaving?: boolean
  disabled?: boolean
  onNext: () => void
}) {
  return (
    <div className="flex justify-end border-t pt-4">
      <Button
        type="button"
        onClick={onNext}
        disabled={isSaving || disabled}
      >
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
  )
}

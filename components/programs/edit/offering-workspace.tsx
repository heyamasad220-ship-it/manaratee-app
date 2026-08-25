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
import { ProgramBrandingColors } from "@/components/programs/edit/program-branding-colors"
import { OfferingPricingPanel } from "@/components/programs/edit/offering-pricing-panel"
import { OfferingRegistrationPanel } from "@/components/programs/edit/offering-registration-panel"
import { OfferingOverviewStaffFields } from "@/components/programs/edit/offering-overview-staff-fields"
import {
  OfferingSchedulePanel,
  OfferingSessionsPanel,
} from "@/components/programs/edit/offering-workspace-panels"
import type { OfferingWorkspaceDataMap } from "@/lib/programs/offering-workspace-types"
import type { ProgramCapacityGroupInput } from "@/lib/programs/program-capacity-group-types"
import { cn } from "@/lib/utils"
import {
  isSessionManagementEnabled,
  type ProgramRegistrationOption,
} from "@/lib/programs/program-registration-option-types"
import type {
  ProgramOffering,
  ProgramOfferingInput,
  ProgramOfferingStatus,
} from "@/lib/programs/program-offering-types"
import {
  OFFERING_DELIVERY_FORMAT_OPTIONS,
  PROGRAM_OFFERING_STATUS_LABELS,
} from "@/lib/programs/program-offering-types"
import type { OfferingDeliveryFormat } from "@/lib/programs/program-offering-attributes"
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
]

const WORKSPACE_TABS = [
  { value: "overview", label: "Overview" },
  { value: "registration", label: "Registration" },
  { value: "pricing", label: "Pricing" },
  { value: "sessions", label: "Sessions" },
  { value: "schedule", label: "Schedule" },
] as const

type WorkspaceTab = (typeof WORKSPACE_TABS)[number]["value"]

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

  async function handleOverviewSave() {
    await onSaveOverview()
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
    (draft.end_date ?? "") !== (savedDraft.end_date ?? "") ||
    (draft.flyer_url ?? "") !== (savedDraft.flyer_url ?? "") ||
    (draft.background_color ?? "") !== (savedDraft.background_color ?? "")

  const workspaceData = offering ? workspaceDataMap[offering.id] : null

  const sessionRegistrationEnabled =
    workspaceData?.registrationOptions
      ? isSessionManagementEnabled(workspaceData.registrationOptions)
      : false

  if (!isCreating && !offering) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a program from the list or add a new one.
      </p>
    )
  }

  if (isCreating) {
    return (
      <div className="space-y-4" onKeyDown={preventFormSubmitOnEnter}>
        <div>
          <h3 className="text-sm font-semibold">New program</h3>
          <p className="text-xs text-muted-foreground">
            Create the program first, then configure registration, pricing, and
            sessions.
          </p>
        </div>
        <OfferingOverviewFields draft={draft} onDraftChange={onDraftChange} />
        <OfferingFeaturePacksFields draft={draft} onDraftChange={onDraftChange} />
        {error ? <WorkspaceError message={error} /> : null}
        <OverviewFooter
          isCreating
          isSaving={isSaving}
          canSave={Boolean(draft.name.trim())}
          onSave={() => void handleOverviewSave()}
          offering={null}
          onDelete={onDelete}
        />
      </div>
    )
  }

  if (!offering || !workspaceData) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading program workspace…
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{offering.name}</h3>
        <p className="text-xs text-muted-foreground">
          Manage registration, pricing, sessions, and more for this program
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
          <div onKeyDown={preventFormSubmitOnEnter} className="space-y-4">
            <OfferingOverviewFields
              draft={draft}
              onDraftChange={onDraftChange}
              offeringId={offering.id}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <OfferingFeaturePacksFields
                draft={draft}
                onDraftChange={onDraftChange}
              />
              <div className="space-y-3 rounded-md border p-3 h-full">
                <p className="text-sm font-medium">Instructors &amp; Staff</p>
                <OfferingOverviewStaffFields
                  programId={program.id}
                  offering={offering}
                  assignments={workspaceData.staffAssignments}
                  sessions={workspaceData.sessions}
                  editing
                  onAssignmentsChange={(assignments) =>
                    onStaffAssignmentsChange?.(offering.id, assignments)
                  }
                />
              </div>
            </div>
            {error ? <WorkspaceError message={error} /> : null}
            <OverviewFooter
              isCreating={false}
              isSaving={isSaving}
              canSave={Boolean(draft.name.trim())}
              onSave={() => void handleOverviewSave()}
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
          />
        </TabsContent>

        <TabsContent value="pricing" className="mt-0">
          <OfferingPricingPanel
            programId={program.id}
            offering={offering}
            workspaceData={workspaceData}
            registrationOptions={workspaceData.registrationOptions}
            programKind={program.program_kind}
          />
        </TabsContent>

        <TabsContent value="sessions" className="mt-0 space-y-4">
          <OfferingSessionsPanel
            programId={program.id}
            offering={offering}
            workspaceData={workspaceData}
            sessionRegistrationEnabled={sessionRegistrationEnabled}
          />
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

export function OfferingSettingsBrandingRow({
  draft,
  onDraftChange,
  offeringId,
  description,
  disabled = false,
}: {
  draft: ProgramOfferingInput
  onDraftChange: (draft: ProgramOfferingInput) => void
  offeringId?: string
  description?: string | null
  disabled?: boolean
}) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[auto_minmax(0,1fr)]">
      <fieldset disabled={disabled} className="min-w-0 disabled:opacity-60">
        <ProgramBrandingColors
          programId={offeringId}
          flyerUrl={draft.flyer_url || ""}
          onFlyerUrlChange={(url) =>
            onDraftChange({ ...draft, flyer_url: url || null })
          }
          initialBackgroundColor={draft.background_color}
          onBackgroundColorChange={(color) =>
            onDraftChange({ ...draft, background_color: color })
          }
        />
      </fieldset>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <div className="min-h-[180px] rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap">
          {description?.trim() || "No description on the program."}
        </div>
      </div>
    </div>
  )
}

export function OfferingOverviewFields({
  draft,
  onDraftChange,
  offeringId,
  disabled = false,
  layout = "default",
  departmentName,
  seasonLabel,
  description,
}: {
  draft: ProgramOfferingInput
  onDraftChange: (draft: ProgramOfferingInput) => void
  offeringId?: string
  disabled?: boolean
  /** Settings page: stacked name/dates/format/status (flyer + description render above). */
  layout?: "default" | "settings"
  departmentName?: string | null
  seasonLabel?: string | null
  description?: string | null
}) {
  if (layout === "settings") {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="offering-name">Program Name</Label>
          <Input
            id="offering-name"
            value={draft.name}
            disabled={disabled}
            onChange={(event) =>
              onDraftChange({ ...draft, name: event.target.value })
            }
            placeholder="Beginner ESL, June Camp, Piano Level 1"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Department</Label>
          <div className="flex min-h-9 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
            {departmentName || "No department"}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="offering-start">Start Date</Label>
            <Input
              id="offering-start"
              type="date"
              value={draft.start_date ?? ""}
              disabled={disabled}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  start_date: event.target.value || null,
                })
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="offering-end">End Date</Label>
            <Input
              id="offering-end"
              type="date"
              value={draft.end_date ?? ""}
              disabled={disabled}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  end_date: event.target.value || null,
                })
              }
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="offering-delivery">Format</Label>
            <select
              id="offering-delivery"
              value={draft.attributes?.delivery_format ?? "in_person"}
              disabled={disabled}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  attributes: {
                    ...draft.attributes,
                    delivery_format: event.target.value as OfferingDeliveryFormat,
                  },
                })
              }
              className="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-60"
            >
              {OFFERING_DELIVERY_FORMAT_OPTIONS.map((option) => (
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
              disabled={disabled}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  status: event.target.value as ProgramOfferingStatus,
                })
              }
              className="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-60"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {PROGRAM_OFFERING_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="offering-name">Name</Label>
          <Input
            id="offering-name"
            value={draft.name}
            disabled={disabled}
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
            disabled={disabled}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                offering_type: event.target
                  .value as ProgramOfferingInput["offering_type"],
              })
            }
            className="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-60"
          >
            {OFFERING_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="offering-delivery">Format</Label>
          <select
            id="offering-delivery"
            value={draft.attributes?.delivery_format ?? "in_person"}
            disabled={disabled}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                attributes: {
                  ...draft.attributes,
                  delivery_format: event.target.value as OfferingDeliveryFormat,
                },
              })
            }
            className="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-60"
            title="Use separate programs for on-site vs online when instructors or capacity differ."
          >
            {OFFERING_DELIVERY_FORMAT_OPTIONS.map((option) => (
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
            disabled={disabled}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                status: event.target.value as ProgramOfferingStatus,
              })
            }
            className="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-60"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {PROGRAM_OFFERING_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <div className="space-y-1.5">
          <Label htmlFor="offering-start">Start date</Label>
          <Input
            id="offering-start"
            type="date"
            value={draft.start_date ?? ""}
            disabled={disabled}
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
            disabled={disabled}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                end_date: event.target.value || null,
              })
            }
          />
        </div>
      </div>

      <fieldset disabled={disabled} className="min-w-0 disabled:opacity-60">
        <ProgramBrandingColors
          programId={offeringId}
          flyerUrl={draft.flyer_url || ""}
          onFlyerUrlChange={(url) =>
            onDraftChange({ ...draft, flyer_url: url || null })
          }
          initialBackgroundColor={draft.background_color}
          onBackgroundColorChange={(color) =>
            onDraftChange({ ...draft, background_color: color })
          }
        />
      </fieldset>
    </div>
  )
}

export function OfferingFeaturePacksFields({
  draft,
  onDraftChange,
  disabled = false,
  plain = false,
}: {
  draft: ProgramOfferingInput
  onDraftChange: (draft: ProgramOfferingInput) => void
  disabled?: boolean
  plain?: boolean
}) {
  return (
    <div className={cn("space-y-3", !plain && "rounded-md border p-3 h-full")}>
      {!plain ? <p className="text-sm font-medium">Feature packs</p> : null}
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="size-4"
          disabled={disabled}
          checked={Boolean(draft.attributes?.attendance_tracked)}
          onChange={(event) =>
            onDraftChange({
              ...draft,
              attributes: {
                ...draft.attributes,
                attendance_tracked: event.target.checked,
              },
            })
          }
        />
        <span>Attendance</span>
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="size-4"
          disabled={disabled}
          checked={Boolean(draft.attributes?.care_enabled)}
          onChange={(event) =>
            onDraftChange({
              ...draft,
              attributes: {
                ...draft.attributes,
                care_enabled: event.target.checked,
              },
            })
          }
        />
        <span>Before &amp; After Care</span>
      </label>
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
  onSave,
  offering,
  onDelete,
  canDelete = true,
  deleteBlockedReason = null,
}: {
  isCreating: boolean
  isSaving: boolean
  canSave: boolean
  onSave: () => void
  offering: ProgramOffering | null
  onDelete: (offeringId: string) => Promise<void>
  canDelete?: boolean
  deleteBlockedReason?: string | null
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
      <div>
        {offering ? (
          canDelete ? (
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
                    This permanently removes the program, its registration
                    options, and linked pricing setup. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => void onDelete(offering.id)}
                  >
                    Delete program
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <p className="text-xs text-muted-foreground">
              {deleteBlockedReason ||
                "Delete is unavailable while this program has registrations or payments."}
            </p>
          )
        ) : null}
      </div>
      <Button type="button" onClick={onSave} disabled={isSaving || !canSave}>
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : isCreating ? (
          "Create program"
        ) : (
          "Save"
        )}
      </Button>
    </div>
  )
}

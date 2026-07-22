"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CalendarDays,
  ClipboardList,
  Eye,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Users,
} from "lucide-react"

import { OfferingOverviewFields, OfferingFeaturePacksFields } from "@/components/programs/edit/offering-workspace"
import { OfferingOverviewStaffFields } from "@/components/programs/edit/offering-overview-staff-fields"
import { OfferingPricingPanel } from "@/components/programs/edit/offering-pricing-panel"
import { OfferingRegistrationPanel } from "@/components/programs/edit/offering-registration-panel"
import {
  OfferingSchedulePanel,
  OfferingSessionsPanel,
} from "@/components/programs/edit/offering-workspace-panels"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { OfferingWorkspaceData } from "@/lib/programs/offering-workspace-types"
import {
  buildProgramCustomerUrl,
  buildProgramRegistrationUrl,
} from "@/lib/programs/program-customer-url"
import type { ProgramCapacityGroupInput } from "@/lib/programs/program-capacity-group-types"
import {
  formatOfferingEnrollmentLabel,
  getOfferingEnrollmentPercent,
} from "@/lib/programs/program-catalog-capacity"
import { updateProgramOffering } from "@/lib/programs/program-offering-actions"
import { isOfferingEnrollmentOpenForProgram } from "@/lib/programs/program-offering-display"
import {
  normalizeOfferingManageTab,
  OFFERING_MANAGE_TABS,
  programOfferingManageHref,
  type OfferingManageTab,
} from "@/lib/programs/program-offering-paths"
import {
  OFFERING_DELIVERY_FORMAT_LABELS,
  PROGRAM_OFFERING_STATUS_LABELS,
  type ProgramOffering,
  type ProgramOfferingInput,
} from "@/lib/programs/program-offering-types"
import { isSessionManagementEnabled } from "@/lib/programs/program-registration-option-types"
import type { Program } from "@/lib/programs/program-types"
import { cn } from "@/lib/utils"

const OFFERING_TYPE_LABELS: Record<string, string> = {
  standard: "Standard",
  academic_year: "Academic year",
  summer: "Summer",
  season: "Season",
  recurring: "Recurring",
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
    attributes: {
      delivery_format: offering.delivery_format ?? "in_person",
      attendance_tracked: offering.attendance_tracked ?? false,
      care_enabled: offering.care_enabled ?? false,
    },
  }
}

function academicYearLabel(start: string | null, end: string | null) {
  if (!start || !end) return "—"
  const startYear = new Date(`${start}T00:00:00`).getFullYear()
  const endYear = new Date(`${end}T00:00:00`).getFullYear()
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return "—"
  return `${startYear}-${endYear}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function OfferingManageClient({
  program,
  departmentName,
  selectedOffering: initialSelected,
  workspaceData: initialWorkspaceData,
  capacityGroups: initialCapacityGroups,
  enrolled,
  initialTab = "overview",
}: {
  program: Program
  departmentName: string | null
  selectedOffering: ProgramOffering
  workspaceData: OfferingWorkspaceData
  capacityGroups: ProgramCapacityGroupInput[]
  enrolled: number
  initialTab?: OfferingManageTab | string
}) {
  const router = useRouter()
  const [selected, setSelected] = React.useState(initialSelected)
  const [workspaceData, setWorkspaceData] = React.useState(initialWorkspaceData)
  const [capacityGroups, setCapacityGroups] = React.useState(initialCapacityGroups)
  const [activeTab, setActiveTab] = React.useState<OfferingManageTab>(
    normalizeOfferingManageTab(initialTab)
  )
  const [editingOverview, setEditingOverview] = React.useState(false)
  const [draft, setDraft] = React.useState(() => offeringToDraft(initialSelected))
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [feedback, setFeedback] = React.useState<string | null>(null)
  const registrationSaveRef = React.useRef<(() => Promise<boolean>) | null>(
    null
  )

  React.useEffect(() => {
    setSelected(initialSelected)
    setWorkspaceData(initialWorkspaceData)
    setCapacityGroups(initialCapacityGroups)
    setDraft(offeringToDraft(initialSelected))
    setEditingOverview(false)
    setActiveTab(normalizeOfferingManageTab(initialTab))
    setError(null)
  }, [
    initialSelected,
    initialWorkspaceData,
    initialCapacityGroups,
    initialTab,
  ])

  const registrationOpen = isOfferingEnrollmentOpenForProgram(selected, program)
  const enrollmentPercent = getOfferingEnrollmentPercent(enrolled, selected)
  const enrollmentLabel = formatOfferingEnrollmentLabel(enrolled, selected)
  const offeringCapacity =
    selected.capacity_mode === "limited"
      ? Math.max(0, Number(selected.capacity || 0))
      : null
  const sessionRegistrationEnabled = isSessionManagementEnabled(
    workspaceData.registrationOptions
  )

  function showMessage(message: string) {
    setFeedback(message)
    window.setTimeout(() => setFeedback(null), 2500)
  }

  function handleTabChange(value: string) {
    const next = normalizeOfferingManageTab(value)
    setActiveTab(next)
    const href = programOfferingManageHref(program.id, selected.id, next)
    router.replace(href, { scroll: false })
  }

  async function handleSaveOverview() {
    setIsSaving(true)
    setError(null)
    try {
      const updated = (await updateProgramOffering(selected.id, draft)) as ProgramOffering
      setSelected(updated)
      setDraft(offeringToDraft(updated))
      setEditingOverview(false)
      router.refresh()
      return true
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save offering."
      )
      return false
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCopyRegistrationLink() {
    if (selected.status !== "active" || program.status !== "active") {
      showMessage("Set program and offering to Active before sharing.")
      return
    }
    try {
      const url = buildProgramRegistrationUrl(program.id, window.location.origin)
      await navigator.clipboard.writeText(url)
      showMessage("Registration link copied.")
    } catch {
      showMessage("Failed to copy link.")
    }
  }

  function handlePreviewOffering() {
    window.open(
      buildProgramCustomerUrl(program.id, window.location.origin),
      "_blank",
      "noopener,noreferrer"
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{selected.name}</h1>
            <Badge variant="secondary" className="rounded-full">
              {OFFERING_TYPE_LABELS[selected.offering_type] || selected.offering_type}
            </Badge>
            <Badge
              variant="secondary"
              className={cn(
                "gap-1.5 rounded-full",
                selected.status === "active"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-zinc-100 text-zinc-600"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  selected.status === "active" ? "bg-emerald-500" : "bg-zinc-400"
                )}
              />
              {PROGRAM_OFFERING_STATUS_LABELS[selected.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Manage this offering&apos;s details, registration, fees, schedule, and staff.
          </p>
          <p className="text-sm text-muted-foreground">
            <Link href={`/programs/${program.id}`} className="hover:underline">
              {program.name}
            </Link>
          </p>
        </div>

        <div className="relative flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handlePreviewOffering}>
            <Eye className="mr-2 h-4 w-4" />
            Preview Offering Page
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCopyRegistrationLink()}
          >
            <Link2 className="mr-2 h-4 w-4" />
            Share Link
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="h-9 w-9">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/programs/${program.id}`}>Back to program</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {feedback ? (
            <p className="absolute right-0 top-full mt-1 text-xs text-muted-foreground">
              {feedback}
            </p>
          ) : null}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-4">
        <TabsList>
          {OFFERING_MANAGE_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="min-w-0 space-y-4">
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <TabsContent value="overview" className="mt-0 space-y-4">
            <TabGlanceRow className="sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
              <GlanceCard
                icon={<ClipboardList className="h-4 w-4 text-emerald-600" />}
                label="Status"
                value={PROGRAM_OFFERING_STATUS_LABELS[selected.status]}
              />
              <GlanceCard
                icon={<CalendarDays className="h-4 w-4 text-amber-600" />}
                label="Type"
                value={
                  OFFERING_TYPE_LABELS[selected.offering_type] ||
                  selected.offering_type
                }
              />
              <GlanceCard
                icon={<ClipboardList className="h-4 w-4 text-sky-600" />}
                label="Delivery"
                value={
                  OFFERING_DELIVERY_FORMAT_LABELS[
                    selected.delivery_format ?? "in_person"
                  ]
                }
              />
              <GlanceCard
                icon={<Users className="h-4 w-4 text-violet-600" />}
                label="Enrollment"
                value={enrollmentLabel}
                footer={
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${enrollmentPercent}%` }}
                    />
                  </div>
                }
              />
            </TabGlanceRow>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-base">Overview</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Basic information about this offering
                  </p>
                </div>
                {!editingOverview ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDraft(offeringToDraft(selected))
                      setEditingOverview(true)
                    }}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
                {editingOverview ? (
                  <>
                    <OfferingOverviewFields draft={draft} onDraftChange={setDraft} />
                    <div className="grid gap-4 lg:grid-cols-2">
                      <OfferingFeaturePacksFields
                        draft={draft}
                        onDraftChange={setDraft}
                      />
                      <div className="space-y-3 rounded-md border p-3 h-full">
                        <p className="text-sm font-medium">Instructors &amp; Staff</p>
                        <OfferingOverviewStaffFields
                          programId={program.id}
                          offering={selected}
                          assignments={workspaceData.staffAssignments}
                          sessions={workspaceData.sessions}
                          editing
                          onAssignmentsChange={(assignments) => {
                            setWorkspaceData((current) => ({
                              ...current,
                              staffAssignments: assignments,
                            }))
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setDraft(offeringToDraft(selected))
                          setEditingOverview(false)
                          setError(null)
                        }}
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void handleSaveOverview()}
                        disabled={isSaving || !draft.name.trim()}
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
                  </>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DetailItem label="Offering name" value={selected.name} />
                    <DetailItem
                      label="Status"
                      value={PROGRAM_OFFERING_STATUS_LABELS[selected.status]}
                    />
                    <DetailItem
                      label="Type"
                      value={
                        OFFERING_TYPE_LABELS[selected.offering_type] ||
                        selected.offering_type
                      }
                    />
                    <DetailItem
                      label="Delivery"
                      value={
                        OFFERING_DELIVERY_FORMAT_LABELS[
                          selected.delivery_format ?? "in_person"
                        ]
                      }
                    />
                    <DetailItem
                      label="Start date"
                      value={formatDate(selected.start_date)}
                    />
                    <DetailItem
                      label="Department"
                      value={departmentName || "No department"}
                    />
                    <DetailItem
                      label="End date"
                      value={formatDate(selected.end_date)}
                    />
                    <DetailItem
                      label="Academic year"
                      value={academicYearLabel(selected.start_date, selected.end_date)}
                    />
                    <DetailItem
                      label="Capacity"
                      value={
                        offeringCapacity != null
                          ? `${offeringCapacity} student${offeringCapacity === 1 ? "" : "s"}`
                          : "Unlimited"
                      }
                    />
                    <OfferingOverviewStaffFields
                      programId={program.id}
                      offering={selected}
                      assignments={workspaceData.staffAssignments}
                      sessions={workspaceData.sessions}
                      editing={false}
                      onAssignmentsChange={(assignments) => {
                        setWorkspaceData((current) => ({
                          ...current,
                          staffAssignments: assignments,
                        }))
                      }}
                    />
                    <DetailItem
                      label="Description"
                      value={program.description?.trim() || "—"}
                      className="sm:col-span-2"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="enrollment" className="mt-0 space-y-6">
            <TabGlanceRow>
              <GlanceCard
                icon={<ClipboardList className="h-4 w-4 text-emerald-600" />}
                label="Registration"
                value={registrationOpen ? "Open" : "Closed"}
                valueClassName={
                  registrationOpen ? "text-emerald-700" : "text-muted-foreground"
                }
              />
              <GlanceCard
                icon={<Users className="h-4 w-4 text-violet-600" />}
                label="Enrollment"
                value={enrollmentLabel}
                footer={
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${enrollmentPercent}%` }}
                    />
                  </div>
                }
              />
              <GlanceCard
                icon={<CalendarDays className="h-4 w-4 text-amber-600" />}
                label="Sessions"
                value={`${workspaceData.sessions.length} scheduled`}
              />
            </TabGlanceRow>

            <section className="space-y-4">
              <OfferingRegistrationPanel
                program={program}
                offering={selected}
                workspaceData={workspaceData}
                capacityGroups={capacityGroups}
                enrolled={enrolled}
                onCapacityGroupsChange={setCapacityGroups}
                onRegistrationOptionsSaved={(_, registrationOptions) => {
                  setWorkspaceData((current) => ({
                    ...current,
                    registrationOptions,
                  }))
                }}
                showSaveButton={false}
                saveHandlerRef={registrationSaveRef}
              />
            </section>

            <section className="space-y-4">
              <OfferingPricingPanel
                programId={program.id}
                offering={selected}
                workspaceData={workspaceData}
                registrationOptions={workspaceData.registrationOptions}
                onBeforeSave={async () => {
                  if (!registrationSaveRef.current) return true
                  return registrationSaveRef.current()
                }}
              />
              <p className="text-xs text-muted-foreground">
                Financial assistance is configured on the program, not on this
                offering.
              </p>
            </section>

            <section className="space-y-4">
              <OfferingSchedulePanel
                programId={program.id}
                offering={selected}
                workspaceData={workspaceData}
              />
              <OfferingSessionsPanel
                programId={program.id}
                offering={selected}
                workspaceData={workspaceData}
                sessionRegistrationEnabled={sessionRegistrationEnabled}
              />
            </section>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function TabGlanceRow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {children}
    </div>
  )
}

function DetailItem({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

function GlanceCard({
  icon,
  label,
  value,
  valueClassName,
  footer,
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueClassName?: string
  footer?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={cn("text-sm font-semibold", valueClassName)}>{value}</p>
      {footer}
    </div>
  )
}

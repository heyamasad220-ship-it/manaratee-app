"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CalendarClock,
  CircleDollarSign,
  Eye,
  Link2,
  Loader2,
  MoreHorizontal,
  Users,
  UsersRound,
} from "lucide-react"

import {
  OfferingOverviewFields,
  OfferingSettingsBrandingRow,
} from "@/components/programs/edit/offering-workspace"
import { OfferingOverviewStaffFields } from "@/components/programs/edit/offering-overview-staff-fields"
import {
  OfferingPricingPanel,
  OfferingPricingProvider,
} from "@/components/programs/edit/offering-pricing-panel"
import { OfferingRegistrationPanel } from "@/components/programs/edit/offering-registration-panel"
import { OfferingSettingsAccordionItem } from "@/components/programs/edit/offering-settings-section"
import {
  OfferingSchedulePanel,
  OfferingSessionsPanel,
} from "@/components/programs/edit/offering-workspace-panels"
import { PageBreadcrumbs } from "@/components/navigation/page-breadcrumbs"
import {
  Accordion,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import type { OfferingManageSummary } from "@/lib/programs/offering-manage-summary"
import type { OfferingWorkspaceData } from "@/lib/programs/offering-workspace-types"
import {
  PROGRAM_LABEL,
  YEAR_SEASON_LABEL,
} from "@/lib/programs/program-display-labels"
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
import {
  formatOfferingDateRange,
  isOfferingEnrollmentOpenForProgram,
} from "@/lib/programs/program-offering-display"
import {
  PROGRAM_OFFERING_STATUS_LABELS,
  type ProgramOffering,
  type ProgramOfferingInput,
} from "@/lib/programs/program-offering-types"
import { isSessionManagementEnabled } from "@/lib/programs/program-registration-option-types"
import type { Program } from "@/lib/programs/program-types"
import { isSeasonalProgramKind } from "@/lib/programs/program-kind"
import { cn } from "@/lib/utils"

const MANAGE_TABS = ["general", "registration", "pricing"] as const
type ManageTab = (typeof MANAGE_TABS)[number]

const REGISTRATION_OPEN_SECTIONS = [
  "registration",
  "participants",
  "questions",
  "capacity",
  "sessions",
]

const GENERAL_OPEN_SECTIONS = ["staff", "schedule"]

function normalizeManageTab(value: string | undefined | null): ManageTab {
  if (value === "registration" || value === "pricing") return value
  return "general"
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
    flyer_url: offering.flyer_url ?? null,
    background_color: offering.background_color ?? null,
    attributes: {
      delivery_format: offering.delivery_format ?? "in_person",
      attendance_tracked: offering.attendance_tracked ?? false,
      care_enabled: offering.care_enabled ?? false,
    },
  }
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return null
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export type OfferingManageNavigationContext = {
  mode: "department" | "programs"
  departmentId?: string
  departmentName?: string | null
  /** Back to department Programs tab (or catalog). */
  backHref: string
  /** Departments list / department detail when mode is department. */
  departmentsListHref?: string
}

export function OfferingManageClient({
  program,
  departmentName,
  selectedOffering: initialSelected,
  workspaceData: initialWorkspaceData,
  capacityGroups: initialCapacityGroups,
  summary: initialSummary,
  navigationContext,
  initialTab,
}: {
  program: Program
  departmentName: string | null
  selectedOffering: ProgramOffering
  workspaceData: OfferingWorkspaceData
  capacityGroups: ProgramCapacityGroupInput[]
  summary: OfferingManageSummary
  navigationContext?: OfferingManageNavigationContext
  initialTab?: string
  /** @deprecated Use summary.enrolled */
  enrolled?: number
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = React.useState<ManageTab>(() =>
    normalizeManageTab(initialTab)
  )
  const [selected, setSelected] = React.useState(initialSelected)
  const [workspaceData, setWorkspaceData] = React.useState(initialWorkspaceData)
  const [capacityGroups, setCapacityGroups] = React.useState(initialCapacityGroups)
  const [summary, setSummary] = React.useState(initialSummary)
  const [draft, setDraft] = React.useState(() => offeringToDraft(initialSelected))
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [feedback, setFeedback] = React.useState<string | null>(null)
  const [registrationResetKey, setRegistrationResetKey] = React.useState(0)
  const [dirty, setDirty] = React.useState(false)
  const registrationSaveRef = React.useRef<(() => Promise<boolean>) | null>(
    null
  )
  const pricingSaveRef = React.useRef<(() => Promise<boolean>) | null>(null)
  const [capacityAccordionPortalTarget, setCapacityAccordionPortalTarget] =
    React.useState<HTMLElement | null>(null)

  React.useEffect(() => {
    setActiveTab(normalizeManageTab(initialTab))
  }, [initialTab])

  React.useEffect(() => {
    setSelected(initialSelected)
    setWorkspaceData(initialWorkspaceData)
    setCapacityGroups(initialCapacityGroups)
    setSummary(initialSummary)
    setDraft(offeringToDraft(initialSelected))
    setDirty(false)
    setError(null)
    setRegistrationResetKey((key) => key + 1)
  }, [
    initialSelected,
    initialWorkspaceData,
    initialCapacityGroups,
    initialSummary,
  ])

  const registrationOpen = isOfferingEnrollmentOpenForProgram(selected, program)
  const enrollmentPercent = getOfferingEnrollmentPercent(
    summary.enrolled,
    selected
  )
  const enrollmentLabel = formatOfferingEnrollmentLabel(
    summary.enrolled,
    selected
  )
  const sessionRegistrationEnabled = isSessionManagementEnabled(
    workspaceData.registrationOptions
  )
  const seasonalMode = isSeasonalProgramKind(program.program_kind)
  const offeringCapacity =
    selected.capacity_mode === "limited"
      ? Math.max(0, Number(selected.capacity || 0))
      : null
  const enrollmentCloseLabel = formatShortDate(
    selected.enrollment_close_date || program.enrollment_close_date
  )

  function markDirty() {
    setDirty(true)
  }

  function updateDraft(next: ProgramOfferingInput) {
    setDraft(next)
    markDirty()
  }

  const nav = navigationContext ?? {
    mode: "programs" as const,
    backHref: "/programs/catalog",
  }

  function showMessage(message: string) {
    setFeedback(message)
    window.setTimeout(() => setFeedback(null), 2500)
  }

  function handleCancel() {
    setDraft(offeringToDraft(selected))
    setDirty(false)
    setError(null)
    setRegistrationResetKey((key) => key + 1)
  }

  async function handleSaveChanges() {
    setIsSaving(true)
    setError(null)
    try {
      const updated = (await updateProgramOffering(
        selected.id,
        draft
      )) as ProgramOffering
      setSelected(updated)
      setDraft(offeringToDraft(updated))

      if (registrationSaveRef.current) {
        const registrationOk = await registrationSaveRef.current()
        if (!registrationOk) {
          return false
        }
      }

      if (pricingSaveRef.current) {
        const pricingOk = await pricingSaveRef.current()
        if (!pricingOk) {
          return false
        }
      }

      setDirty(false)
      router.push(nav.backHref)
      return true
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : `Failed to save ${PROGRAM_LABEL.toLowerCase()}.`
      )
      return false
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCopyRegistrationLink() {
    if (selected.status !== "active" || program.status !== "active") {
      showMessage(
        `Set ${YEAR_SEASON_LABEL.toLowerCase()} and ${PROGRAM_LABEL.toLowerCase()} to Active before sharing.`
      )
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

  const departmentNav = nav.mode === "department"
  const departmentLabel = nav.departmentName || departmentName || "Department"
  const pageBreadcrumbs = departmentNav
    ? [
        {
          label: departmentLabel,
          // Prefer department Programs workspace (previous page), then department detail.
          href: nav.backHref || nav.departmentsListHref,
        },
        { label: selected.name },
      ]
    : seasonalMode
      ? [
          { label: "Programs", href: "/programs/catalog" },
          { label: selected.name },
        ]
      : [
          { label: "Programs", href: "/programs/catalog" },
          { label: program.name, href: `/programs/${program.id}` },
          { label: selected.name },
        ]

  return (
    <div className="flex flex-col bg-slate-50/60 pb-28">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <PageBreadcrumbs items={pageBreadcrumbs} />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                {selected.name}
              </h1>
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
                    selected.status === "active"
                      ? "bg-emerald-500"
                      : "bg-zinc-400"
                  )}
                />
                {PROGRAM_OFFERING_STATUS_LABELS[selected.status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {seasonalMode
                ? departmentName
                  ? `Seasonal camp · ${departmentName}`
                  : "Seasonal camp"
                : `${program.name}${departmentName ? ` · ${departmentName}` : ""}`}
            </p>
          </div>

          <div className="relative flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-white"
              onClick={handlePreviewOffering}
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview {PROGRAM_LABEL} Page
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-white"
              onClick={() => void handleCopyRegistrationLink()}
            >
              <Link2 className="mr-2 h-4 w-4" />
              Share Link
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 bg-white"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/programs/${program.id}`}>
                    Back to {YEAR_SEASON_LABEL.toLowerCase()}
                  </Link>
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

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <StatCardsRow equal columns={4}>
          <StatCard
            fill
            tone="sky"
            layout="header"
            icon={CalendarClock}
            label="Registration"
            value={registrationOpen ? "Open" : "Closed"}
            hint={
              enrollmentCloseLabel
                ? registrationOpen
                  ? `Closes ${enrollmentCloseLabel}`
                  : `Closed on ${enrollmentCloseLabel}`
                : formatOfferingDateRange(
                    selected.start_date,
                    selected.end_date
                  ) || undefined
            }
          />
          <StatCard
            fill
            tone="violet"
            layout="header"
            icon={Users}
            label="Enrollment"
            value={`${summary.enrolled} enrolled`}
            hint={
              summary.waitlistCount > 0
                ? `Waitlist: ${summary.waitlistCount}`
                : offeringCapacity != null
                  ? enrollmentLabel
                  : "Unlimited capacity"
            }
          />
          <StatCard
            fill
            tone="amber"
            layout="header"
            icon={UsersRound}
            label="Capacity"
            value={
              offeringCapacity != null
                ? `${summary.enrolled} / ${offeringCapacity}`
                : "Unlimited"
            }
            hint={
              offeringCapacity != null
                ? `${enrollmentPercent}% of capacity`
                : "No capacity limit set"
            }
          />
          <StatCard
            fill
            tone="emerald"
            layout="header"
            icon={CircleDollarSign}
            label="Revenue"
            value={formatMoney(summary.revenueCollected)}
            hint="Collected to date"
          />
        </StatCardsRow>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(normalizeManageTab(value))}
          className="space-y-4"
        >
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
            <TabsTrigger value="general" className="px-4">
              General
            </TabsTrigger>
            <TabsTrigger value="registration" className="px-4">
              Registration
            </TabsTrigger>
            <TabsTrigger value="pricing" className="px-4">
              Pricing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-0 space-y-5">
            <OfferingSettingsBrandingRow
              draft={draft}
              onDraftChange={updateDraft}
              offeringId={selected.id}
              description={program.description}
            />
            <OfferingOverviewFields
              draft={draft}
              onDraftChange={updateDraft}
              offeringId={selected.id}
              layout="settings"
              departmentName={departmentName}
            />
            <Accordion
              type="multiple"
              defaultValue={GENERAL_OPEN_SECTIONS}
              className="space-y-3"
            >
              <OfferingSettingsAccordionItem
                value="staff"
                step={1}
                title="Staff"
              >
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
              </OfferingSettingsAccordionItem>

              <OfferingSettingsAccordionItem
                value="schedule"
                step={2}
                title="Schedule"
              >
                <OfferingSchedulePanel
                  programId={program.id}
                  offering={selected}
                  workspaceData={workspaceData}
                />
              </OfferingSettingsAccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="registration" className="mt-0">
            <Accordion
              type="multiple"
              defaultValue={REGISTRATION_OPEN_SECTIONS}
              className="space-y-3"
            >
              <OfferingRegistrationPanel
                key={`${selected.id}-${registrationResetKey}`}
                program={program}
                offering={selected}
                workspaceData={workspaceData}
                capacityGroups={capacityGroups}
                enrolled={summary.enrolled}
                onCapacityGroupsChange={(groups) => {
                  setCapacityGroups(groups)
                  markDirty()
                }}
                onRegistrationOptionsSaved={(_, registrationOptions) => {
                  setWorkspaceData((current) => ({
                    ...current,
                    registrationOptions,
                  }))
                }}
                showSaveButton={false}
                saveHandlerRef={registrationSaveRef}
                settingsSplit
                capacityAccordionPortalTarget={capacityAccordionPortalTarget}
                onDirty={markDirty}
                attendanceTracked={Boolean(draft.attributes?.attendance_tracked)}
                onAttendanceTrackedChange={(enabled) => {
                  setDraft((current) => ({
                    ...current,
                    attributes: {
                      ...current.attributes,
                      attendance_tracked: enabled,
                    },
                  }))
                  markDirty()
                }}
              />

              <div ref={setCapacityAccordionPortalTarget} className="contents" />

              <OfferingSettingsAccordionItem
                value="sessions"
                step={5}
                title="Sessions"
              >
                <OfferingSessionsPanel
                  programId={program.id}
                  offering={selected}
                  workspaceData={workspaceData}
                  sessionRegistrationEnabled={sessionRegistrationEnabled}
                />
              </OfferingSettingsAccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="pricing" className="mt-0">
            <OfferingPricingProvider
              programId={program.id}
              offering={selected}
              workspaceData={workspaceData}
              registrationOptions={workspaceData.registrationOptions}
              saveHandlerRef={pricingSaveRef}
            >
              <OfferingPricingPanel
                programId={program.id}
                offering={selected}
                workspaceData={workspaceData}
                registrationOptions={workspaceData.registrationOptions}
                showSaveButton={false}
                showTitle={false}
                showPaymentStructure={false}
                showBillingSchedule
                split
              />
            </OfferingPricingProvider>
          </TabsContent>
        </Tabs>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-6 py-3">
          {dirty ? (
            <p className="mr-auto text-sm text-muted-foreground">
              You have unsaved changes.
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving || !dirty}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => void handleSaveChanges()}
            disabled={isSaving || !draft.name.trim()}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

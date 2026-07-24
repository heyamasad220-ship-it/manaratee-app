"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Calendar,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Tag,
  Users,
} from "lucide-react"

import { ProgramBasicsSection } from "@/components/programs/edit/program-basics-section"
import type { VisibilityType } from "@/components/programs/edit/types"
import { ProgramDefaultsSettingsPanel } from "@/components/programs/program-defaults-settings-panel"
import { ProgramDetailHeaderActions } from "@/components/programs/program-detail-header-actions"
import { ProgramEnrollmentsReportPanel } from "@/components/programs/program-enrollments-report-panel"
import { ProgramStatusSelect } from "@/components/programs/program-status-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Department } from "@/lib/departments/department-types"
import {
  getProgramRegistrationAvailabilityLabel,
  isProgramAcceptingRegistration,
} from "@/lib/programs/program-enrollment-availability"
import { formatProgramAgeEligibility } from "@/lib/programs/program-eligibility-display"
import { updateProgramBasics } from "@/lib/programs/program-detail-actions"
import {
  formatOfferingDateRange,
  isOfferingEnrollmentOpenForProgram,
} from "@/lib/programs/program-offering-display"
import { formatOfferingEnrollmentLabel } from "@/lib/programs/program-catalog-capacity"
import {
  OFFERING_DELIVERY_FORMAT_LABELS,
  OFFERING_DELIVERY_FORMAT_OPTIONS,
  PROGRAM_OFFERING_STATUS_LABELS,
  type ProgramOffering,
} from "@/lib/programs/program-offering-types"
import type { OfferingDeliveryFormat } from "@/lib/programs/program-offering-attributes"
import { DEFAULT_NEW_OFFERING_INHERIT_FLAGS } from "@/lib/programs/program-offering-inherit"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import {
  PROGRAM_LABEL,
  PROGRAM_LABEL_PLURAL,
  YEAR_SEASON_LABEL,
  programCountPhrase,
} from "@/lib/programs/program-display-labels"
import { getProgramStatusLabel, type ProgramStatus } from "@/lib/programs/program-status"
import type { Program } from "@/lib/programs/program-types"
import { cn } from "@/lib/utils"

const OFFERING_TYPE_LABELS: Record<string, string> = {
  standard: "Standard",
  academic_year: "Academic year",
  summer: "Summer",
  season: "Season",
  recurring: "Recurring",
}

const FLYER_PLACEHOLDER_COLORS = [
  "bg-sky-500",
  "bg-emerald-400",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-400",
  "bg-indigo-500",
] as const

const PROGRAM_DETAIL_TABS = [
  "overview",
  "settings",
  "offerings",
  "reports",
] as const

type ProgramDetailTab = (typeof PROGRAM_DETAIL_TABS)[number]

function normalizeProgramDetailTab(value: string | null | undefined): ProgramDetailTab {
  if (value && (PROGRAM_DETAIL_TABS as readonly string[]).includes(value)) {
    return value as ProgramDetailTab
  }
  return "overview"
}

function formatDate(value: string | null | undefined) {
  if (!value) return "TBD"

  // Date-only columns (YYYY-MM-DD) need a local midnight parse.
  // Timestamps (created_at, etc.) are already ISO and must not get T00:00:00 appended.
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value)

  if (Number.isNaN(parsed.getTime())) return "—"

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatVisibility(value: string | null | undefined) {
  switch (value) {
    case "members_only":
      return "Members only"
    case "private":
      return "Private"
    default:
      return "Public"
  }
}

function getFlyerPlaceholderColor(programId: string) {
  let hash = 0
  for (let index = 0; index < programId.length; index += 1) {
    hash = (hash + programId.charCodeAt(index) * (index + 1)) % 997
  }
  return FLYER_PLACEHOLDER_COLORS[hash % FLYER_PLACEHOLDER_COLORS.length]
}

function getStatusBadgeClass(status: ProgramStatus) {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
    case "paused":
      return "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50"
    case "archived":
      return "border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-100"
    default:
      return "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-50"
  }
}

function getStatusDotClass(status: ProgramStatus) {
  switch (status) {
    case "active":
      return "bg-emerald-500"
    case "paused":
      return "bg-amber-500"
    case "archived":
      return "bg-zinc-400"
    default:
      return "bg-slate-400"
  }
}

function toVisibility(value: string | null | undefined): VisibilityType {
  if (value === "members_only" || value === "private") return value
  return "public"
}

export type ProgramDetailOfferingRow = {
  offering: ProgramOffering
  enrolled: number
}

export function ProgramDetailClient({
  program,
  departments,
  departmentName,
  visibility,
  offerings,
  initialTab = "overview",
}: {
  program: Program
  departments: Department[]
  departmentName: string | null
  visibility: string | null
  offerings: ProgramDetailOfferingRow[]
  initialTab?: string
}) {
  const router = useRouter()
  const [editingOverview, setEditingOverview] = React.useState(false)
  const [detailTab, setDetailTab] = React.useState(() =>
    normalizeProgramDetailTab(initialTab)
  )
  const [programStatus, setProgramStatus] = React.useState(program.status)
  const [isSaving, setIsSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const overviewFormRef = React.useRef<HTMLFormElement>(null)

  React.useEffect(() => {
    setProgramStatus(program.status)
  }, [program.status])

  const audienceLabel = `${program.gender || "All"} • ${formatProgramAgeEligibility(program)}`
  const availabilityLabel = getProgramRegistrationAvailabilityLabel(program)
  const acceptingRegistration = isProgramAcceptingRegistration(program)
  const activeOfferings = offerings.filter(
    (row) => row.offering.status !== "archived"
  )
  const archivedOfferings = offerings.filter(
    (row) => row.offering.status === "archived"
  )

  function startEditingOverview() {
    setSaveError(null)
    setProgramStatus(program.status)
    setDetailTab("overview")
    setEditingOverview(true)
  }

  async function handleSaveOverview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const name = String(formData.get("name") || "").trim()
    if (!name) {
      setSaveError(`${YEAR_SEASON_LABEL} name is required.`)
      return
    }

    setIsSaving(true)
    setSaveError(null)

    const result = await updateProgramBasics({
      programId: program.id,
      name,
      subtitle: String(formData.get("subtitle") || "").trim() || null,
      description: String(formData.get("description") || "").trim() || null,
      department_id: String(formData.get("department_id") || "").trim() || null,
      flyer_url: String(formData.get("flyer_url") || "").trim() || null,
      background_color:
        String(formData.get("background_color") || "").trim() || null,
      visibility: toVisibility(String(formData.get("visibility") || "public")),
      status: programStatus,
      start_date: String(formData.get("start_date") || "").trim() || null,
      end_date: String(formData.get("end_date") || "").trim() || null,
      enrollment_open_date:
        String(formData.get("enrollment_open_date") || "").trim() || null,
      enrollment_close_date:
        String(formData.get("enrollment_close_date") || "").trim() || null,
      gender: String(formData.get("gender") || "All").trim() || "All",
      min_age: (() => {
        const raw = String(formData.get("min_age") || "").trim()
        if (!raw) return null
        const n = Number(raw)
        return Number.isFinite(n) ? n : null
      })(),
      max_age: (() => {
        const raw = String(formData.get("max_age") || "").trim()
        if (!raw) return null
        const n = Number(raw)
        return Number.isFinite(n) ? n : null
      })(),
      syncOfferingDates: true,
    })

    setIsSaving(false)

    if (!result.success) {
      setSaveError(result.error)
      return
    }

    setEditingOverview(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{program.name}</h1>
            <Badge
              variant="secondary"
              className={cn(
                "gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                getStatusBadgeClass(program.status)
              )}
            >
              <span
                className={cn("h-1.5 w-1.5 rounded-full", getStatusDotClass(program.status))}
              />
              {getProgramStatusLabel(program.status)}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Manage year/season details, programs, and settings.
          </p>
        </div>

        <ProgramDetailHeaderActions
          programId={program.id}
          programStatus={program.status}
          onEditProgram={startEditingOverview}
        />
      </div>

      <Tabs
        value={editingOverview ? "overview" : detailTab}
        onValueChange={(value) => {
          if (editingOverview) return
          const next = normalizeProgramDetailTab(value)
          setDetailTab(next)
          const url = new URL(window.location.href)
          if (next === "overview") {
            url.searchParams.delete("tab")
          } else {
            url.searchParams.set("tab", next)
          }
          router.replace(`${url.pathname}${url.search}`, { scroll: false })
        }}
        className="space-y-4"
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger
            value="overview"
            className="rounded-md border border-transparent px-3 py-1.5 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            disabled={editingOverview}
            className="rounded-md border border-transparent px-3 py-1.5 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Settings
          </TabsTrigger>
          <TabsTrigger
            value="offerings"
            disabled={editingOverview}
            className="rounded-md border border-transparent px-3 py-1.5 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            {PROGRAM_LABEL_PLURAL}
          </TabsTrigger>
          <TabsTrigger
            value="reports"
            disabled={editingOverview}
            className="rounded-md border border-transparent px-3 py-1.5 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-6">
          <OverviewCard
            program={program}
            departments={departments}
            departmentName={departmentName}
            visibility={visibility}
            offeringCount={activeOfferings.length}
            audienceLabel={audienceLabel}
            availabilityLabel={availabilityLabel}
            acceptingRegistration={acceptingRegistration}
            editing={editingOverview}
            programStatus={programStatus}
            onProgramStatusChange={setProgramStatus}
            isSaving={isSaving}
            saveError={saveError}
            formRef={overviewFormRef}
            onStartEdit={startEditingOverview}
            onCancelEdit={() => {
              setEditingOverview(false)
              setSaveError(null)
              setProgramStatus(program.status)
            }}
            onSave={handleSaveOverview}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-0">
          <ProgramDefaultsSettingsPanel program={program} />
        </TabsContent>

        <TabsContent value="offerings" className="mt-0">
          <OfferingsPanel
            program={program}
            rows={activeOfferings}
            archivedCount={archivedOfferings.length}
            showArchived={archivedOfferings}
          />
        </TabsContent>

        <TabsContent value="reports" className="mt-0">
          <ProgramEnrollmentsReportPanel
            programId={program.id}
            programName={program.name}
            offerings={offerings.map((row) => row.offering)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function OverviewCard({
  program,
  departments,
  departmentName,
  visibility,
  offeringCount,
  audienceLabel,
  availabilityLabel,
  acceptingRegistration,
  editing,
  programStatus,
  onProgramStatusChange,
  isSaving,
  saveError,
  formRef,
  onStartEdit,
  onCancelEdit,
  onSave,
}: {
  program: Program
  departments: Department[]
  departmentName: string | null
  visibility: string | null
  offeringCount: number
  audienceLabel: string
  availabilityLabel: string
  acceptingRegistration: boolean
  editing: boolean
  programStatus: string
  onProgramStatusChange: (status: string) => void
  isSaving: boolean
  saveError: string | null
  formRef: React.RefObject<HTMLFormElement | null>
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>
}) {
  const publicHref = `/customer/programs/${program.id}`

  if (editing) {
    return (
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Overview</CardTitle>
            <p className="text-sm text-muted-foreground">
              Edit name, schedule, eligibility (age/gender), branding, and publishing
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={(event) => void onSave(event)} className="space-y-4">
            {saveError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {saveError}
              </p>
            ) : null}
            <ProgramBasicsSection
              program={program}
              programId={program.id}
              departments={departments}
              status={programStatus}
              onStatusChange={onProgramStatusChange}
              initialVisibility={toVisibility(visibility)}
              programStatusFallback={program.status}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCancelEdit}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
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
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-0">
        <div>
          <CardTitle className="text-base">Overview</CardTitle>
          <p className="text-sm text-muted-foreground">
            Basic information about this program
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onStartEdit}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
      </CardHeader>
      <CardContent className="grid gap-6 p-5 pt-4 lg:grid-cols-[140px_minmax(0,1fr)_220px]">
        <div
          className={cn(
            "aspect-[3/4] w-full max-w-[140px] overflow-hidden rounded-lg",
            !program.flyer_url && getFlyerPlaceholderColor(program.id)
          )}
        >
          {program.flyer_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={program.flyer_url}
              alt={`${program.name} flyer`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-3xl font-semibold text-white/90">
                {program.name.trim().charAt(0).toUpperCase() || "P"}
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          {program.subtitle ? (
            <p className="text-sm text-muted-foreground">{program.subtitle}</p>
          ) : null}
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                {formatDate(program.start_date)} - {formatDate(program.end_date)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0" />
              <span>{audienceLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 shrink-0" />
              <span>
                {programCountPhrase(offeringCount)}
              </span>
            </div>
            <p
              className={cn(
                "text-sm font-medium",
                acceptingRegistration ? "text-emerald-700" : "text-foreground/80"
              )}
            >
              {availabilityLabel}
            </p>
            <Link
              href={publicHref}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              View Public Page
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border bg-muted/20 p-4 text-sm">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </p>
            <ProgramStatusSelect programId={program.id} status={program.status} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Department
            </p>
            <p className="mt-1 font-medium">{departmentName || "No department"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Visibility
            </p>
            <p className="mt-1 font-medium">{formatVisibility(visibility)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Created
            </p>
            <p className="mt-1 font-medium">{formatDate(program.created_at)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function OfferingsPanel({
  program,
  rows,
  archivedCount,
  showArchived,
}: {
  program: Program
  rows: ProgramDetailOfferingRow[]
  archivedCount: number
  showArchived?: ProgramDetailOfferingRow[]
}) {
  const router = useRouter()
  const [addOpen, setAddOpen] = React.useState(false)
  const [offeringName, setOfferingName] = React.useState("")
  const [deliveryFormat, setDeliveryFormat] =
    React.useState<OfferingDeliveryFormat>("in_person")
  const [inheritDates, setInheritDates] = React.useState(
    DEFAULT_NEW_OFFERING_INHERIT_FLAGS.inherit_dates
  )
  const [inheritEligibility, setInheritEligibility] = React.useState(
    DEFAULT_NEW_OFFERING_INHERIT_FLAGS.inherit_eligibility
  )
  const [inheritEnrollment, setInheritEnrollment] = React.useState(
    DEFAULT_NEW_OFFERING_INHERIT_FLAGS.inherit_enrollment
  )
  const [creating, setCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)

  function resetCreateForm() {
    setOfferingName("")
    setDeliveryFormat("in_person")
    setInheritDates(DEFAULT_NEW_OFFERING_INHERIT_FLAGS.inherit_dates)
    setInheritEligibility(DEFAULT_NEW_OFFERING_INHERIT_FLAGS.inherit_eligibility)
    setInheritEnrollment(DEFAULT_NEW_OFFERING_INHERIT_FLAGS.inherit_enrollment)
    setCreateError(null)
  }

  async function handleCreateOffering() {
    const name = offeringName.trim()
    if (!name) {
      setCreateError(`${PROGRAM_LABEL} name is required.`)
      return
    }

    setCreating(true)
    setCreateError(null)

    try {
      const { createProgramOffering } = await import(
        "@/lib/programs/program-offering-actions"
      )
      const created = await createProgramOffering(program.id, {
        name,
        offering_type: "standard",
        start_date: program.start_date,
        end_date: program.end_date,
        enrollment_open_date: program.enrollment_open_date,
        enrollment_close_date: program.enrollment_close_date,
        status: program.status === "draft" ? "draft" : "active",
        inherit_dates: inheritDates,
        inherit_eligibility: inheritEligibility,
        inherit_enrollment: inheritEnrollment,
        attributes: {
          delivery_format: deliveryFormat,
        },
      })
      setAddOpen(false)
      resetCreateForm()
      router.push(programOfferingManageHref(program.id, created.id as string))
      router.refresh()
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : `Could not create ${PROGRAM_LABEL.toLowerCase()}.`
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {PROGRAM_LABEL_PLURAL}
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage {PROGRAM_LABEL_PLURAL.toLowerCase()}, pricing, sessions, and
              staff assignments.
            </p>
          </div>
          <Button size="sm" type="button" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add {PROGRAM_LABEL}
          </Button>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No {PROGRAM_LABEL_PLURAL.toLowerCase()} yet. Add a{" "}
              {PROGRAM_LABEL.toLowerCase()} to open registration, fees, and
              schedule.
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-4"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add first {PROGRAM_LABEL.toLowerCase()}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{PROGRAM_LABEL}</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Enrollment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ offering, enrolled }) => {
                  const enrollmentOpen = isOfferingEnrollmentOpenForProgram(
                    offering,
                    program
                  )
                  const dateRange = formatOfferingDateRange(
                    offering.inherit_dates
                      ? program.start_date
                      : offering.start_date,
                    offering.inherit_dates
                      ? program.end_date
                      : offering.end_date
                  )
                  return (
                    <TableRow key={offering.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={programOfferingManageHref(program.id, offering.id)}
                          className="text-sky-600 hover:text-sky-700 hover:underline"
                        >
                          {offering.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {
                          OFFERING_DELIVERY_FORMAT_LABELS[
                            offering.delivery_format ?? "in_person"
                          ]
                        }
                      </TableCell>
                      <TableCell>
                        {OFFERING_TYPE_LABELS[offering.offering_type] ||
                          offering.offering_type}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p>{dateRange}</p>
                          {offering.inherit_dates === true ? (
                            <p className="text-xs text-muted-foreground">
                              From {YEAR_SEASON_LABEL.toLowerCase()}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p>
                            {formatOfferingEnrollmentLabel(enrolled, offering)}
                          </p>
                          <p
                            className={cn(
                              "text-xs",
                              enrollmentOpen
                                ? "text-emerald-700"
                                : "text-muted-foreground"
                            )}
                          >
                            {enrollmentOpen ? "Registration open" : "Registration closed"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="rounded-full">
                          {PROGRAM_OFFERING_STATUS_LABELS[offering.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {showArchived && showArchived.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Archived ({archivedCount})
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {showArchived.map(({ offering }) => (
                <li key={offering.id}>
                  <Link
                    href={programOfferingManageHref(program.id, offering.id)}
                    className="text-sky-600 hover:text-sky-700 hover:underline"
                  >
                    {offering.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Dialog open={addOpen} onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) resetCreateForm()
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add {PROGRAM_LABEL.toLowerCase()}</DialogTitle>
              <DialogDescription>
                Create a class or track. {YEAR_SEASON_LABEL} defaults are used
                unless you turn off inherit below. Fees and schedule are set after
                create.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="detail-offering-name">Name</Label>
                <Input
                  id="detail-offering-name"
                  value={offeringName}
                  onChange={(event) => setOfferingName(event.target.value)}
                  placeholder="e.g. Tajweed Beginner — Centre"
                  disabled={creating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="detail-offering-delivery">Delivery</Label>
                <select
                  id="detail-offering-delivery"
                  value={deliveryFormat}
                  onChange={(event) =>
                    setDeliveryFormat(
                      event.target.value as OfferingDeliveryFormat
                    )
                  }
                  disabled={creating}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {OFFERING_DELIVERY_FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Create separate {PROGRAM_LABEL_PLURAL.toLowerCase()} for on-site
                  and online when instructors or capacity differ.
                </p>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">
                    Use {YEAR_SEASON_LABEL.toLowerCase()} defaults
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Turn off a group only when this{" "}
                    {PROGRAM_LABEL.toLowerCase()} needs different dates,
                    eligibility, or enrollment settings.
                  </p>
                </div>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>Dates &amp; enrollment window</span>
                  <Switch
                    checked={inheritDates}
                    onCheckedChange={setInheritDates}
                    disabled={creating}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>Eligibility (age / gender)</span>
                  <Switch
                    checked={inheritEligibility}
                    onCheckedChange={setInheritEligibility}
                    disabled={creating}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>Enrollment types &amp; waitlist</span>
                  <Switch
                    checked={inheritEnrollment}
                    onCheckedChange={setInheritEnrollment}
                    disabled={creating}
                  />
                </label>
              </div>

              {createError ? (
                <p className="text-sm text-destructive">{createError}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleCreateOffering()}
                disabled={creating}
              >
                {creating ? "Creating…" : `Create ${PROGRAM_LABEL.toLowerCase()}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

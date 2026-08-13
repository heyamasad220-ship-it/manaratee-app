"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Calendar,
  ExternalLink,
  Loader2,
  Pencil,
  Tag,
  Users,
} from "lucide-react"

import { ProgramBasicsSection } from "@/components/programs/edit/program-basics-section"
import type { VisibilityType } from "@/components/programs/edit/types"
import { ProgramDefaultsSettingsPanel } from "@/components/programs/program-defaults-settings-panel"
import { ProgramDetailHeaderActions } from "@/components/programs/program-detail-header-actions"
import type { ProgramDetailOfferingRow } from "@/components/programs/program-offerings-list-panel"
import { ProgramStatusSelect } from "@/components/programs/program-status-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Department } from "@/lib/departments/department-types"
import {
  getProgramRegistrationAvailabilityLabel,
  isProgramAcceptingRegistration,
} from "@/lib/programs/program-enrollment-availability"
import { formatProgramAgeEligibility, formatProgramGenderLabel } from "@/lib/programs/program-eligibility-display"
import { updateProgramBasics } from "@/lib/programs/program-detail-actions"
import {
  YEAR_SEASON_LABEL,
  programCountPhrase,
} from "@/lib/programs/program-display-labels"
import { getProgramStatusLabel, type ProgramStatus } from "@/lib/programs/program-status"
import type { Program } from "@/lib/programs/program-types"
import { cn } from "@/lib/utils"

export type { ProgramDetailOfferingRow }

const FLYER_PLACEHOLDER_COLORS = [
  "bg-sky-500",
  "bg-emerald-400",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-400",
  "bg-indigo-500",
] as const

const PROGRAM_DETAIL_TABS = ["overview", "settings"] as const

type ProgramDetailTab = (typeof PROGRAM_DETAIL_TABS)[number]

function normalizeProgramDetailTab(value: string | null | undefined): ProgramDetailTab {
  // Legacy Programs / Reports tabs redirect at the page level when possible.
  if (value === "reports" || value === "offerings") return "overview"
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

  const audienceLabel = `${formatProgramGenderLabel(program.gender)} • ${formatProgramAgeEligibility(program)}`
  const availabilityLabel = getProgramRegistrationAvailabilityLabel(program)
  const acceptingRegistration = isProgramAcceptingRegistration(program)
  const activeOfferings = offerings.filter(
    (row) => row.offering.status !== "archived"
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
            Manage program details and settings.
          </p>
        </div>

        <ProgramDetailHeaderActions
          programId={program.id}
          programStatus={program.status}
          programKind={program.program_kind}
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
              Created
            </p>
            <p className="mt-1 font-medium">{formatDate(program.created_at)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

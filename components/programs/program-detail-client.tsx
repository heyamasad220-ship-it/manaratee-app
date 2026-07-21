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
import { ProgramDetailHeaderActions } from "@/components/programs/program-detail-header-actions"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Department } from "@/lib/departments/department-types"
import {
  getProgramRegistrationAvailabilityLabel,
  isProgramAcceptingRegistration,
} from "@/lib/programs/program-enrollment-availability"
import { formatProgramAgeEligibility } from "@/lib/programs/program-eligibility-display"
import { updateProgramBasics } from "@/lib/programs/program-detail-actions"
import {
  formatOfferingDateRange,
  isOfferingEnrollmentOpen,
} from "@/lib/programs/program-offering-display"
import { formatOfferingEnrollmentLabel } from "@/lib/programs/program-catalog-capacity"
import {
  PROGRAM_OFFERING_STATUS_LABELS,
  type ProgramOffering,
} from "@/lib/programs/program-offering-types"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
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

function formatDate(value: string | null | undefined) {
  if (!value) return "TBD"
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
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
}: {
  program: Program
  departments: Department[]
  departmentName: string | null
  visibility: string | null
  offerings: ProgramDetailOfferingRow[]
}) {
  const router = useRouter()
  const [editingOverview, setEditingOverview] = React.useState(false)
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
    setEditingOverview(true)
  }

  async function handleSaveOverview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const name = String(formData.get("name") || "").trim()
    if (!name) {
      setSaveError("Program name is required.")
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
            Manage program details, offerings, and settings.
          </p>
        </div>

        <ProgramDetailHeaderActions
          programId={program.id}
          programStatus={program.status}
          onEditProgram={startEditingOverview}
        />
      </div>

      <div className="space-y-6">
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
        {!editingOverview ? (
          <OfferingsPanel
            program={program}
            rows={activeOfferings}
            archivedCount={archivedOfferings.length}
            showArchived={archivedOfferings}
          />
        ) : null}
      </div>
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
                {offeringCount} Offering{offeringCount === 1 ? "" : "s"}
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
  const [creating, setCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)

  async function handleCreateOffering() {
    const name = offeringName.trim()
    if (!name) {
      setCreateError("Offering name is required.")
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
      })
      setAddOpen(false)
      setOfferingName("")
      router.push(programOfferingManageHref(program.id, created.id as string))
      router.refresh()
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Could not create offering."
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
            <h2 className="text-lg font-semibold tracking-tight">Offerings</h2>
            <p className="text-sm text-muted-foreground">
              Manage offerings, pricing, sessions, and staff assignments.
            </p>
          </div>
          <Button size="sm" type="button" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Offering
          </Button>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No offerings yet. Add an offering to open registration, fees, and
              schedule.
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-4"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add first offering
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Offering</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Enrollment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ offering, enrolled }) => {
                  const enrollmentOpen = isOfferingEnrollmentOpen(offering)
                  return (
                    <TableRow key={offering.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={programOfferingManageHref(program.id, offering.id)}
                          className="hover:text-foreground hover:underline"
                        >
                          {offering.name}
                        </Link>
                        {offering.is_default ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            Default
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {OFFERING_TYPE_LABELS[offering.offering_type] ||
                          offering.offering_type}
                      </TableCell>
                      <TableCell>
                        {formatOfferingDateRange(offering.start_date, offering.end_date)}
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
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={programOfferingManageHref(program.id, offering.id)}>
                            Manage
                          </Link>
                        </Button>
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
                    className="hover:text-foreground hover:underline"
                  >
                    {offering.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add offering</DialogTitle>
              <DialogDescription>
                Customers register for offerings. Registration, fees, and
                schedule are configured on the offering after you create it.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="detail-offering-name">Name</Label>
              <Input
                id="detail-offering-name"
                value={offeringName}
                onChange={(event) => setOfferingName(event.target.value)}
                placeholder="e.g. Beginner Quran"
                disabled={creating}
              />
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
                {creating ? "Creating…" : "Create offering"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

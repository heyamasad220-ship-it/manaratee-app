"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import {
  DollarSign,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  Calendar,
  Tag,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react"

import { ProgramFlyerField } from "@/components/programs/edit/program-flyer-field"
import { DepartmentYearConfigureDialog } from "@/components/departments/department-year-configure-dialog"
import { ProgramCardActions } from "@/components/programs/program-card-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import type { DepartmentYearProgramRow } from "@/lib/departments/department-active-programs"
import {
  closeDepartmentYearProgramAction,
  createDepartmentYearProgramAction,
  fetchDepartmentYearProgramsAction,
  type DepartmentYearProgramsBundle,
} from "@/lib/departments/department-year-actions"
import {
  fetchDepartmentWorkspaceOverviewAction,
  type DepartmentWorkspaceOverview,
} from "@/lib/departments/department-workspace-overview"
import { departmentGroupWorkspaceHref } from "@/lib/donations/donation-group-path"
import {
  YEAR_SEASON_LABEL,
  YEAR_SEASON_LABEL_PLURAL,
  programCountPhrase,
} from "@/lib/programs/program-display-labels"
import { getProgramStatusLabel, type ProgramStatus } from "@/lib/programs/program-status"
import { formatProgramGenderLabel } from "@/lib/programs/program-eligibility-display"
import { cn } from "@/lib/utils"

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNet(value: number) {
  const abs = formatMoney(Math.abs(value)).replace(/^\$/, "")
  if (value > 0) return `+${abs}`
  if (value < 0) return `-${abs}`
  return abs
}

const FLYER_PLACEHOLDER_COLORS = [
  "bg-sky-500",
  "bg-emerald-400",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-400",
  "bg-indigo-500",
] as const

function getFlyerPlaceholderColor(programId: string) {
  let hash = 0
  for (let index = 0; index < programId.length; index += 1) {
    hash = (hash + programId.charCodeAt(index) * (index + 1)) % 997
  }
  return FLYER_PLACEHOLDER_COLORS[hash % FLYER_PLACEHOLDER_COLORS.length]
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

function statusBadgeClass(status: string) {
  if (status === "active") return "bg-emerald-50 text-emerald-800"
  if (status === "draft") return "bg-slate-100 text-slate-700"
  if (status === "paused") return "bg-amber-50 text-amber-800"
  if (status === "closed") return "bg-slate-200 text-slate-700"
  return "bg-muted text-muted-foreground"
}

function statusDotClass(status: string) {
  if (status === "active") return "bg-emerald-500"
  if (status === "draft") return "bg-slate-400"
  if (status === "paused") return "bg-amber-500"
  if (status === "closed") return "bg-slate-500"
  return "bg-muted-foreground"
}

export function DepartmentOverviewPanel({
  departmentId,
  departmentName,
  highlightYearProgramId = null,
}: {
  departmentId: string
  departmentName: string
  /** From `?year=` — scroll/highlight that year card. */
  highlightYearProgramId?: string | null
}) {
  const [bundle, setBundle] = useState<DepartmentYearProgramsBundle | null>(null)
  const [overview, setOverview] = useState<DepartmentWorkspaceOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [closeTarget, setCloseTarget] = useState<DepartmentYearProgramRow | null>(null)
  const [configureTarget, setConfigureTarget] =
    useState<DepartmentYearProgramRow | null>(null)
  const [isPending, startTransition] = useTransition()

  const [newName, setNewName] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [copyFromId, setCopyFromId] = useState<string>("")
  const [flyerUrl, setFlyerUrl] = useState("")
  const [confirmName, setConfirmName] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [yearsResult, overviewResult] = await Promise.all([
      fetchDepartmentYearProgramsAction(departmentId),
      fetchDepartmentWorkspaceOverviewAction(departmentId),
    ])
    if (!yearsResult.success) {
      setError(yearsResult.error)
      setBundle(null)
    } else {
      setBundle(yearsResult.data)
    }
    setOverview(overviewResult.success ? overviewResult.overview : null)
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!highlightYearProgramId || loading) return
    const el = document.getElementById(`year-card-${highlightYearProgramId}`)
    el?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [highlightYearProgramId, loading, bundle])

  function openCreate() {
    setFormError(null)
    setNewName(`${departmentName} `)
    setStartDate("")
    setEndDate("")
    setCopyFromId(bundle?.openPrograms[0]?.id || bundle?.archivedPrograms[0]?.id || "")
    setFlyerUrl("")
    setCreateOpen(true)
  }

  function handleCreate() {
    setFormError(null)
    startTransition(async () => {
      const result = await createDepartmentYearProgramAction({
        departmentId,
        name: newName,
        startDate: startDate || null,
        endDate: endDate || null,
        copyFromProgramId: copyFromId || null,
        flyerUrl: flyerUrl || null,
      })
      if (!result.success) {
        setFormError(result.error)
        return
      }
      setCreateOpen(false)
      await load()
    })
  }

  function handleCloseYear() {
    if (!closeTarget) return
    setFormError(null)
    startTransition(async () => {
      const result = await closeDepartmentYearProgramAction({
        departmentId,
        programId: closeTarget.id,
        confirmName,
      })
      if (!result.success) {
        setFormError(result.error)
        return
      }
      setCloseTarget(null)
      setConfirmName("")
      await load()
    })
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading year programs...
      </div>
    )
  }

  if (error || !bundle) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>{error || "Could not load year programs."}</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  const copySources = [...bundle.openPrograms, ...bundle.archivedPrograms]

  return (
    <div className="space-y-6">
      {overview ? (
        <StatCardsRow equal columns={5}>
          <StatCard
            layout="header"
            fill
            tone="blue"
            label="Participants"
            value={overview.studentsCount}
            icon={GraduationCap}
            hint={
              overview.hasOpenYears ? "Open years only" : "No open years"
            }
          />
          <StatCard
            layout="header"
            fill
            tone="sky"
            label="Staff"
            value={overview.staffCount}
            icon={Users}
            hint="Department employees"
          />
          <StatCard
            layout="header"
            fill
            tone="emerald"
            label="Revenue"
            value={formatMoney(overview.revenue)}
            icon={DollarSign}
            hint={
              overview.hasOpenYears
                ? "Open years · Programs billing"
                : "No open years"
            }
          />
          <StatCard
            layout="header"
            fill
            tone="amber"
            label="Expenses"
            value={formatMoney(overview.expenses)}
            icon={Wallet}
            hint="Approved payroll"
          />
          <StatCard
            layout="header"
            fill
            tone={overview.net >= 0 ? "emerald" : "rose"}
            label="Net"
            value={formatNet(overview.net)}
            icon={TrendingUp}
            hint="Revenue − expenses"
          />
        </StatCardsRow>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {YEAR_SEASON_LABEL_PLURAL}
          </h2>
        </div>
        {bundle.canManageYears ? (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add {YEAR_SEASON_LABEL}
          </Button>
        ) : null}
      </div>

      {bundle.openPrograms.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Open {YEAR_SEASON_LABEL_PLURAL}</CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {bundle.openPrograms.map((program) => {
            const capacity = program.capacity || 0
            const percent =
              capacity > 0
                ? Math.min(100, Math.round((program.enrolled / capacity) * 100))
                : 0
            return (
              <Card
                key={program.id}
                id={`year-card-${program.id}`}
                className={cn(
                  "overflow-hidden border-border/80 shadow-sm scroll-mt-24",
                  highlightYearProgramId === program.id &&
                    "ring-2 ring-primary/40"
                )}
              >
                <div className="flex h-full flex-col gap-3 p-4">
                  <div className="flex gap-3">
                    <div
                      className={cn(
                        "relative aspect-square w-16 shrink-0 overflow-hidden rounded-lg sm:w-20",
                        !program.flyerUrl && getFlyerPlaceholderColor(program.id)
                      )}
                    >
                      {program.flyerUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={program.flyerUrl}
                          alt={`${program.name} flyer`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <span className="text-xl font-semibold text-white/90">
                            {program.name.trim().charAt(0).toUpperCase() || "P"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1.5">
                          <p className="text-base font-semibold leading-snug tracking-tight">
                            {program.name}
                          </p>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                              statusBadgeClass(program.status)
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                statusDotClass(program.status)
                              )}
                            />
                            {getProgramStatusLabel(
                              (program.status as ProgramStatus) || "active"
                            )}
                          </Badge>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <ProgramCardActions
                            programId={program.id}
                            programName={program.name}
                            programStatus={program.status}
                            editLabel={bundle.canManageYears ? "Edit" : "View"}
                            hideDelete
                            onConfigure={
                              bundle.canManageYears
                                ? () => setConfigureTarget(program)
                                : undefined
                            }
                            detailsHref={departmentGroupWorkspaceHref(departmentId, {
                              tab: "overview",
                              yearProgramId: program.id,
                            })}
                            onArchiveYear={
                              bundle.canArchiveYears &&
                              program.status !== "closed" &&
                              program.status !== "archived"
                                ? () => {
                                    setCloseTarget(program)
                                    setConfirmName("")
                                    setFormError(null)
                                  }
                                : undefined
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 shrink-0" />
                          <span className="truncate">
                            {formatDate(program.startDate)} -{" "}
                            {formatDate(program.endDate)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 shrink-0" />
                            <span className="truncate">
                              {formatProgramGenderLabel(program.gender)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 shrink-0" />
                            <span>{programCountPhrase(program.offeringCount)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-muted-foreground">Enrollment</span>
                      <span className="font-medium tabular-nums">
                        {capacity > 0
                          ? `${program.enrolled} / ${capacity}`
                          : `${program.enrolled} enrolled`}
                      </span>
                    </div>
                    {capacity > 0 ? (
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {bundle.archivedPrograms.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {bundle.archivedPrograms.length} archived year
          {bundle.archivedPrograms.length === 1 ? "" : "s"} (not shown in operating
          tabs).
        </p>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add {YEAR_SEASON_LABEL}</DialogTitle>
            <DialogDescription>
              Creates a {YEAR_SEASON_LABEL.toLowerCase()} under this department.
              Optionally copy courses and teachers from a previous year (rosters
              stay empty).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="year-name">{YEAR_SEASON_LABEL} name</Label>
              <Input
                id="year-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`${departmentName} 2026-2027`}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="year-start">Start date</Label>
                <Input
                  id="year-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year-end">End date</Label>
                <Input
                  id="year-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Copy structure from</Label>
              <Select
                value={copyFromId || "none"}
                onValueChange={(value) => setCopyFromId(value === "none" ? "" : value)}
                disabled={isPending || copySources.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No copy (blank year)</SelectItem>
                  {copySources.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                      {program.status === "archived" ? " (archived)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Flyer (optional)</Label>
              <ProgramFlyerField
                value={flyerUrl}
                onValueChange={setFlyerUrl}
                uploadOnly
                hideHiddenInput
              />
            </div>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isPending || !newName.trim()}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(closeTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setCloseTarget(null)
            setConfirmName("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close year</DialogTitle>
            <DialogDescription>
              Marks {closeTarget?.name} as closed. Registrations and payments stay available
              for reports and comparison; offerings stop taking new registrations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-close-year">
              Type <span className="font-medium">{closeTarget?.name}</span> to confirm
            </Label>
            <Input
              id="confirm-close-year"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              disabled={isPending}
            />
          </div>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloseTarget(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCloseYear}
              disabled={isPending || confirmName.trim() !== (closeTarget?.name || "").trim()}
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Close year
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DepartmentYearConfigureDialog
        departmentId={departmentId}
        programId={configureTarget?.id ?? null}
        programName={configureTarget?.name}
        open={Boolean(configureTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setConfigureTarget(null)
        }}
        onSaved={load}
      />
    </div>
  )
}

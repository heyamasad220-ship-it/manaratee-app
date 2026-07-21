"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import {
  Loader2,
  Plus,
  RefreshCw,
  Calendar,
  Tag,
  Users,
} from "lucide-react"

import { ProgramFlyerField } from "@/components/programs/edit/program-flyer-field"
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
import type { DepartmentYearProgramRow } from "@/lib/departments/department-active-programs"
import {
  archiveDepartmentYearProgramAction,
  createDepartmentYearProgramAction,
  fetchDepartmentYearProgramsAction,
  updateDepartmentYearFlyerAction,
  type DepartmentYearProgramsBundle,
} from "@/lib/departments/department-year-actions"
import { departmentGroupWorkspaceHref } from "@/lib/donations/donation-group-path"
import { getProgramStatusLabel, type ProgramStatus } from "@/lib/programs/program-status"
import { cn } from "@/lib/utils"

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
  return "bg-muted text-muted-foreground"
}

function statusDotClass(status: string) {
  if (status === "active") return "bg-emerald-500"
  if (status === "draft") return "bg-slate-400"
  if (status === "paused") return "bg-amber-500"
  return "bg-muted-foreground"
}

export function DepartmentOverviewPanel({
  departmentId,
  departmentName,
}: {
  departmentId: string
  departmentName: string
}) {
  const [bundle, setBundle] = useState<DepartmentYearProgramsBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<DepartmentYearProgramRow | null>(null)
  const [flyerTarget, setFlyerTarget] = useState<DepartmentYearProgramRow | null>(null)
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
    const result = await fetchDepartmentYearProgramsAction(departmentId)
    if (!result.success) {
      setError(result.error)
      setBundle(null)
    } else {
      setBundle(result.data)
    }
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    void load()
  }, [load])

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

  function handleArchive() {
    if (!archiveTarget) return
    setFormError(null)
    startTransition(async () => {
      const result = await archiveDepartmentYearProgramAction({
        departmentId,
        programId: archiveTarget.id,
        confirmName,
      })
      if (!result.success) {
        setFormError(result.error)
        return
      }
      setArchiveTarget(null)
      setConfirmName("")
      await load()
    })
  }

  function handleFlyerSave() {
    if (!flyerTarget) return
    setFormError(null)
    startTransition(async () => {
      const result = await updateDepartmentYearFlyerAction({
        departmentId,
        programId: flyerTarget.id,
        flyerUrl: flyerUrl || null,
      })
      if (!result.success) {
        setFormError(result.error)
        return
      }
      setFlyerTarget(null)
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Year programs</h2>
          <p className="text-sm text-muted-foreground">
            Set up the academic year here (like Catalog). Courses are offerings under the
            year program. Operating tabs show open years only; archived years are under
            Reports.
          </p>
        </div>
        {bundle.canManageYears ? (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add year program
          </Button>
        ) : null}
      </div>

      {bundle.openPrograms.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No open year</CardTitle>
            <CardDescription>
              Create the academic year program for this department to start offerings and
              rosters.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {bundle.openPrograms.map((program) => {
            const capacity = program.capacity || 0
            const percent =
              capacity > 0
                ? Math.min(100, Math.round((program.enrolled / capacity) * 100))
                : 0
            return (
              <Card
                key={program.id}
                className="overflow-hidden border-border/80 shadow-sm"
              >
                <div className="flex gap-4 p-4">
                  <div
                    className={cn(
                      "relative aspect-square w-24 shrink-0 overflow-hidden rounded-lg sm:w-28",
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
                        <span className="text-2xl font-semibold text-white/90">
                          {program.name.trim().charAt(0).toUpperCase() || "P"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
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
                      <ProgramCardActions
                        programId={program.id}
                        programName={program.name}
                        programStatus={program.status}
                        editLabel="View / Edit"
                        hideDelete
                        onEditFlyer={
                          bundle.canManageYears
                            ? () => {
                                setFlyerTarget(program)
                                setFlyerUrl(program.flyerUrl || "")
                                setFormError(null)
                              }
                            : undefined
                        }
                        onArchiveYear={
                          bundle.canArchiveYears
                            ? () => {
                                setArchiveTarget(program)
                                setConfirmName("")
                                setFormError(null)
                              }
                            : undefined
                        }
                      />
                    </div>

                    <div className="space-y-1.5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 shrink-0" />
                        <span>
                          {formatDate(program.startDate)} - {formatDate(program.endDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 shrink-0" />
                        <span className="truncate">{program.gender || "All"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 shrink-0" />
                        <span>
                          {program.offeringCount} offering
                          {program.offeringCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-muted-foreground">Enrollment</span>
                        <span className="font-medium tabular-nums">
                          {program.enrolled} / {capacity}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
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
          {bundle.archivedPrograms.length === 1 ? "" : "s"} — view under{" "}
          <Link
            href={departmentGroupWorkspaceHref(departmentId, { tab: "reports" })}
            className="underline underline-offset-2"
          >
            Reports
          </Link>
          .
        </p>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add year program</DialogTitle>
            <DialogDescription>
              Creates the academic year under this department. Optionally copy courses and
              teachers from a previous year (rosters stay empty).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="year-name">Program name</Label>
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
        open={Boolean(flyerTarget)}
        onOpenChange={(open) => {
          if (!open) setFlyerTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Year flyer</DialogTitle>
            <DialogDescription>
              {flyerTarget?.name} — one flyer per year. Catalog uses this image.
            </DialogDescription>
          </DialogHeader>
          <ProgramFlyerField
            programId={flyerTarget?.id}
            value={flyerUrl}
            onValueChange={setFlyerUrl}
            uploadOnly
            hideHiddenInput
          />
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlyerTarget(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleFlyerSave} disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save flyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTarget(null)
            setConfirmName("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive year</DialogTitle>
            <DialogDescription>
              This makes {archiveTarget?.name} read-only and moves it to Reports. Confirm
              payments and payroll are complete before continuing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-archive">
              Type <span className="font-medium">{archiveTarget?.name}</span> to confirm
            </Label>
            <Input
              id="confirm-archive"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              disabled={isPending}
            />
          </div>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchiveTarget(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchive}
              disabled={isPending || confirmName.trim() !== (archiveTarget?.name || "").trim()}
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Archive year
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

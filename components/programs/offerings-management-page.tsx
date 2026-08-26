"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  countActiveMoreFilters,
  DEFAULT_OFFERINGS_MANAGEMENT_FILTERS,
  departmentsFromRows,
  filterOfferingsManagementRows,
  formatManagementEnrollment,
  formatManagementFee,
  groupOfferingsByProgram,
  OFFERINGS_VIEW_STORAGE_KEY,
  parseOfferingsManagementView,
  programsFromRows,
  sortOfferingsManagementRows,
  summarizeOfferingsManagement,
  uniqueInstructors,
  type OfferingsManagementFilters,
  type OfferingsManagementProgramOption,
  type OfferingsManagementRow,
  type OfferingsManagementSortKey,
  type OfferingsManagementView,
} from "@/lib/programs/offerings-management"
import { PROGRAM_KIND_TAG_LABELS, type ProgramKind } from "@/lib/programs/program-kind"
import { archiveProgramOffering } from "@/lib/programs/program-offering-actions"
import {
  OFFERING_DELIVERY_FORMAT_OPTIONS,
  PROGRAM_OFFERING_STATUS_LABELS,
  type ProgramOfferingStatus,
} from "@/lib/programs/program-offering-types"
import { duplicateProgramOffering } from "@/lib/programs/program-offering-duplicate-actions"
import { buildCopyName } from "@/lib/programs/program-fee-plan-copy-utils"
import {
  OFFERING_REGISTRATION_STATE_LABELS,
  type OfferingRegistrationState,
} from "@/lib/programs/program-offering-display"
import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"
import { cn } from "@/lib/utils"

function statusBadgeClass(status: ProgramOfferingStatus) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "draft") return "border-slate-200 bg-slate-50 text-slate-600"
  if (status === "closed") return "border-slate-200 bg-slate-100 text-slate-700"
  if (status === "cancelled") return "border-rose-200 bg-rose-50 text-rose-800"
  return "border-zinc-200 bg-zinc-100 text-zinc-600"
}

function statusDotClass(status: ProgramOfferingStatus) {
  if (status === "active") return "bg-emerald-500"
  if (status === "draft") return "bg-slate-400"
  if (status === "closed") return "bg-slate-500"
  if (status === "cancelled") return "bg-rose-500"
  return "bg-zinc-400"
}

function registrationClass(state: OfferingRegistrationState) {
  if (state === "open") return "text-emerald-700"
  if (state === "upcoming") return "text-amber-700"
  return "text-muted-foreground"
}

function OfferingStatusBadge({ status }: { status: ProgramOfferingStatus }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        statusBadgeClass(status)
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", statusDotClass(status))} />
      {PROGRAM_OFFERING_STATUS_LABELS[status]}
    </Badge>
  )
}

function SortButton({
  label,
  column,
  sortKey,
  direction,
  onSort,
  className,
}: {
  label: string
  column: OfferingsManagementSortKey
  sortKey: OfferingsManagementSortKey
  direction: "asc" | "desc"
  onSort: (column: OfferingsManagementSortKey) => void
  className?: string
}) {
  const active = sortKey === column
  return (
    <button
      type="button"
      className={cn(
        "-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted",
        className
      )}
      onClick={() => onSort(column)}
    >
      {label}
      {active ? (
        direction === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : null}
    </button>
  )
}

function FilterSelect({
  label,
  value,
  onValueChange,
  items,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  items: Array<{ value: string; label: string }>
}) {
  return (
    <div className="min-w-[9.5rem] space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger size="sm" className="w-full bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function RowActions({
  row,
  onDuplicate,
  onArchived,
}: {
  row: OfferingsManagementRow
  onDuplicate: (row: OfferingsManagementRow) => void
  onArchived: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`Actions for ${row.name}`}
          disabled={busy}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(row.offeringHref)}>
          Open Offering
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(row.editHref)}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDuplicate(row)}>
          Duplicate
        </DropdownMenuItem>
        {row.status !== "archived" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                void (async () => {
                  const confirmed = window.confirm(
                    `Archive ${row.name}? It will no longer appear as an active offering.`
                  )
                  if (!confirmed) return
                  setBusy(true)
                  try {
                    await archiveProgramOffering(row.id)
                    onArchived()
                  } catch (error) {
                    window.alert(
                      error instanceof Error
                        ? error.message
                        : "Could not archive offering."
                    )
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function OfferingsManagementPage({
  rows,
  createPrograms,
  publicCatalogUrl,
  initialFilters,
  initialView,
  urlHasView = false,
}: {
  rows: OfferingsManagementRow[]
  createPrograms: OfferingsManagementProgramOption[]
  publicCatalogUrl: string | null
  initialFilters: OfferingsManagementFilters
  initialView: OfferingsManagementView
  urlHasView?: boolean
}) {
  const router = useRouter()
  const [filters, setFilters] = React.useState(initialFilters)
  const [query, setQuery] = React.useState(initialFilters.q)
  const [view, setView] = React.useState<OfferingsManagementView>(initialView)
  const [sortKey, setSortKey] =
    React.useState<OfferingsManagementSortKey>("offering")
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc")
  const [addOpen, setAddOpen] = React.useState(false)
  const [selectedProgramId, setSelectedProgramId] = React.useState(
    createPrograms.length === 1 ? createPrograms[0].id : ""
  )
  const [duplicateTarget, setDuplicateTarget] =
    React.useState<OfferingsManagementRow | null>(null)
  const [duplicateName, setDuplicateName] = React.useState("")
  const [duplicating, setDuplicating] = React.useState(false)
  const [duplicateError, setDuplicateError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [feedback, setFeedback] = React.useState<string | null>(null)
  const filtersRef = React.useRef(filters)
  filtersRef.current = filters
  const viewRef = React.useRef(view)
  viewRef.current = view

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (query === filtersRef.current.q) return
      applyFilters({ q: query })
    }, 250)
    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce query only
  }, [query])

  React.useEffect(() => {
    if (urlHasView) return
    try {
      const stored = parseOfferingsManagementView(
        window.localStorage.getItem(OFFERINGS_VIEW_STORAGE_KEY)
      )
      if (stored) setView(stored)
    } catch {
      /* ignore */
    }
  }, [urlHasView])

  React.useEffect(() => {
    try {
      window.localStorage.setItem(OFFERINGS_VIEW_STORAGE_KEY, view)
    } catch {
      /* ignore */
    }
  }, [view])

  function showFeedback(message: string) {
    setFeedback(message)
    window.setTimeout(() => setFeedback(null), 2500)
  }

  function syncUrl(
    nextFilters: OfferingsManagementFilters,
    nextView: OfferingsManagementView
  ) {
    const params = new URLSearchParams()
    if (nextFilters.q.trim()) params.set("q", nextFilters.q.trim())
    if (nextFilters.department !== "all") {
      params.set("department", nextFilters.department)
    }
    if (nextFilters.program !== "all") params.set("program", nextFilters.program)
    if (nextFilters.type !== "all") params.set("type", nextFilters.type)
    if (nextFilters.status !== DEFAULT_OFFERINGS_MANAGEMENT_FILTERS.status) {
      params.set("status", nextFilters.status)
    }
    if (nextFilters.instructor !== "all") {
      params.set("instructor", nextFilters.instructor)
    }
    if (nextFilters.delivery !== "all") params.set("delivery", nextFilters.delivery)
    if (nextFilters.registration !== "all") {
      params.set("registration", nextFilters.registration)
    }
    if (nextFilters.enrollment !== "all") {
      params.set("enrollment", nextFilters.enrollment)
    }
    if (nextFilters.date !== "all") params.set("date", nextFilters.date)
    if (nextView !== "table") params.set("view", nextView)
    const queryString = params.toString()
    const href = queryString ? `/programs/catalog?${queryString}` : "/programs/catalog"
    window.history.replaceState(window.history.state, "", href)
  }

  function applyFilters(next: Partial<OfferingsManagementFilters>) {
    const current = filtersRef.current
    const merged: OfferingsManagementFilters = { ...current, ...next }
    if (next.department && next.department !== current.department) {
      const stillValid =
        merged.program === "all" ||
        programsFromRows(rows, merged.department).some(
          (program) => program.id === merged.program
        )
      if (!stillValid) merged.program = "all"
    }
    filtersRef.current = merged
    setFilters(merged)
    syncUrl(merged, viewRef.current)
  }

  function handleViewChange(next: OfferingsManagementView) {
    viewRef.current = next
    setView(next)
    syncUrl(filtersRef.current, next)
  }

  function handleSort(column: OfferingsManagementSortKey) {
    if (sortKey === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
      return
    }
    setSortKey(column)
    setSortDirection(column === "enrollment" ? "desc" : "asc")
  }

  function clearFilters() {
    setQuery("")
    applyFilters({ ...DEFAULT_OFFERINGS_MANAGEMENT_FILTERS })
  }

  async function copyPublicCatalogLink() {
    if (!publicCatalogUrl) return
    try {
      await navigator.clipboard.writeText(publicCatalogUrl)
      setCopied(true)
      showFeedback("Public catalog link copied.")
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      showFeedback("Failed to copy link.")
    }
  }

  function openAddOffering() {
    setSelectedProgramId(createPrograms.length === 1 ? createPrograms[0].id : "")
    setAddOpen(true)
  }

  function continueAddOffering() {
    if (!selectedProgramId) return
    setAddOpen(false)
    router.push(programWorkspaceHref(selectedProgramId, { tab: "offerings" }))
  }

  const filtered = sortOfferingsManagementRows(
    filterOfferingsManagementRows(rows, { ...filters, q: query }),
    sortKey,
    sortDirection
  )
  const summary = summarizeOfferingsManagement(rows)
  const departments = departmentsFromRows(rows)
  const programs = programsFromRows(rows, filters.department)
  const instructors = uniqueInstructors(rows)
  const moreFilterCount = countActiveMoreFilters(filters)
  const noOfferingsExist = rows.length === 0
  const filtersHideResults = !noOfferingsExist && filtered.length === 0
  const groups = view === "grouped" ? groupOfferingsByProgram(filtered) : []

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Offerings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage offerings across all programs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={openAddOffering}>
            <Plus className="h-4 w-4" />
            Add Offering
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Page menu"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={!publicCatalogUrl}
                onClick={() => {
                  if (!publicCatalogUrl) return
                  window.open(publicCatalogUrl, "_blank", "noopener,noreferrer")
                }}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Public Catalog
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!publicCatalogUrl}
                onClick={() => void copyPublicCatalogLink()}
              >
                <Copy className="mr-2 h-4 w-4" />
                {copied ? "Copied" : "Copy Public Catalog Link"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {feedback ? (
        <p className="text-sm text-muted-foreground">{feedback}</p>
      ) : null}

      {!noOfferingsExist ? (
        <p className="text-sm text-muted-foreground">
          <SummaryButton
            active={filters.status === "all"}
            onClick={() => applyFilters({ status: "all" })}
          >
            {summary.total} Offerings
          </SummaryButton>
          {" · "}
          <SummaryButton
            active={filters.status === "active"}
            onClick={() => applyFilters({ status: "active" })}
          >
            {summary.active} Active
          </SummaryButton>
          {" · "}
          <SummaryButton
            active={filters.registration === "open"}
            onClick={() => applyFilters({ registration: "open" })}
          >
            {summary.registrationOpen} Registration Open
          </SummaryButton>
          {" · "}
          <SummaryButton
            active={filters.enrollment === "full"}
            onClick={() => applyFilters({ enrollment: "full" })}
          >
            {summary.full} Full
          </SummaryButton>
          {" · "}
          <SummaryButton
            active={filters.enrollment === "waitlisted"}
            onClick={() => applyFilters({ enrollment: "waitlisted" })}
          >
            {summary.waitlisted} Waitlisted
          </SummaryButton>
        </p>
      ) : null}

      {!noOfferingsExist ? (
        <>
          <div className="relative max-w-md">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search offerings..."
              aria-label="Search offerings"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <FilterSelect
              label="Department"
              value={filters.department}
              onValueChange={(value) => applyFilters({ department: value })}
              items={[
                { value: "all", label: "All Departments" },
                ...departments.map((department) => ({
                  value: department.id,
                  label: department.name,
                })),
              ]}
            />
            <FilterSelect
              label="Program"
              value={filters.program}
              onValueChange={(value) => applyFilters({ program: value })}
              items={[
                { value: "all", label: "All Programs" },
                ...programs.map((program) => ({
                  value: program.id,
                  label: program.name,
                })),
              ]}
            />
            <FilterSelect
              label="Type"
              value={filters.type}
              onValueChange={(value) => applyFilters({ type: value })}
              items={[
                { value: "all", label: "All Types" },
                ...(Object.keys(PROGRAM_KIND_TAG_LABELS) as ProgramKind[]).map(
                  (kind) => ({
                    value: kind,
                    label: PROGRAM_KIND_TAG_LABELS[kind],
                  })
                ),
              ]}
            />
            <FilterSelect
              label="Status"
              value={filters.status}
              onValueChange={(value) => applyFilters({ status: value })}
              items={[
                { value: "all", label: "All Statuses" },
                { value: "active", label: PROGRAM_OFFERING_STATUS_LABELS.active },
                { value: "draft", label: PROGRAM_OFFERING_STATUS_LABELS.draft },
                { value: "closed", label: PROGRAM_OFFERING_STATUS_LABELS.closed },
                {
                  value: "cancelled",
                  label: PROGRAM_OFFERING_STATUS_LABELS.cancelled,
                },
                {
                  value: "archived",
                  label: PROGRAM_OFFERING_STATUS_LABELS.archived,
                },
              ]}
            />

            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  More Filters
                  {moreFilterCount > 0 ? (
                    <span className="rounded-full bg-muted px-1.5 text-[11px]">
                      {moreFilterCount}
                    </span>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 space-y-3">
                <FilterSelect
                  label="Instructor"
                  value={filters.instructor}
                  onValueChange={(value) => applyFilters({ instructor: value })}
                  items={[
                    { value: "all", label: "All Instructors" },
                    ...instructors.map((name) => ({ value: name, label: name })),
                  ]}
                />
                <FilterSelect
                  label="Delivery"
                  value={filters.delivery}
                  onValueChange={(value) => applyFilters({ delivery: value })}
                  items={[
                    { value: "all", label: "All" },
                    ...OFFERING_DELIVERY_FORMAT_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                    })),
                  ]}
                />
                <FilterSelect
                  label="Registration"
                  value={filters.registration}
                  onValueChange={(value) => applyFilters({ registration: value })}
                  items={[
                    { value: "all", label: "All" },
                    { value: "open", label: OFFERING_REGISTRATION_STATE_LABELS.open },
                    {
                      value: "closed",
                      label: OFFERING_REGISTRATION_STATE_LABELS.closed,
                    },
                    {
                      value: "upcoming",
                      label: OFFERING_REGISTRATION_STATE_LABELS.upcoming,
                    },
                  ]}
                />
                <FilterSelect
                  label="Enrollment"
                  value={filters.enrollment}
                  onValueChange={(value) => applyFilters({ enrollment: value })}
                  items={[
                    { value: "all", label: "All" },
                    { value: "available", label: "Available" },
                    { value: "nearly_full", label: "Nearly Full" },
                    { value: "full", label: "Full" },
                    { value: "waitlisted", label: "Waitlisted" },
                  ]}
                />
                <FilterSelect
                  label="Date"
                  value={filters.date}
                  onValueChange={(value) => applyFilters({ date: value })}
                  items={[
                    { value: "all", label: "All" },
                    { value: "current", label: "Current" },
                  ]}
                />
              </PopoverContent>
            </Popover>

            <div className="ml-auto flex items-center gap-1 text-sm">
              <span className="text-muted-foreground">View:</span>
              <Button
                type="button"
                size="sm"
                variant={view === "table" ? "secondary" : "ghost"}
                onClick={() => handleViewChange("table")}
              >
                Table
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === "grouped" ? "secondary" : "ghost"}
                onClick={() => handleViewChange("grouped")}
              >
                Grouped
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {noOfferingsExist ? (
        <div className="rounded-lg border bg-card px-6 py-12 text-center">
          <h2 className="text-base font-semibold">No offerings yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Offerings are the classes, groups, sessions, or other registration
            options within a program.
          </p>
          <Button type="button" className="mt-4" size="sm" onClick={openAddOffering}>
            <Plus className="h-4 w-4" />
            Add Offering
          </Button>
        </div>
      ) : filtersHideResults ? (
        <div className="rounded-lg border bg-card px-6 py-12 text-center">
          <h2 className="text-base font-semibold">
            No offerings match these filters.
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={clearFilters}
          >
            Clear filters
          </Button>
        </div>
      ) : view === "grouped" ? (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.programId} className="space-y-2">
              <div>
                <Link
                  href={group.programHref}
                  className="text-base font-semibold text-sky-700 hover:underline"
                >
                  {group.programName}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {[
                    group.departmentName,
                    group.programKindLabel,
                    `${group.enrolled} enrolled`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <OfferingsTable
                rows={group.offerings}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                grouped
                onDuplicate={(row) => {
                  setDuplicateTarget(row)
                  setDuplicateName(buildCopyName(row.name))
                  setDuplicateError(null)
                }}
                onArchived={() => {
                  showFeedback("Offering archived.")
                  router.refresh()
                }}
              />
            </section>
          ))}
        </div>
      ) : (
        <OfferingsTable
          rows={filtered}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          onDuplicate={(row) => {
            setDuplicateTarget(row)
            setDuplicateName(buildCopyName(row.name))
            setDuplicateError(null)
          }}
          onArchived={() => {
            showFeedback("Offering archived.")
            router.refresh()
          }}
        />
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select a program</DialogTitle>
            <DialogDescription>
              Offerings belong to a program. Choose one to continue to Add
              Offering.
            </DialogDescription>
          </DialogHeader>
          {createPrograms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create a program first, then add offerings.
            </p>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="add-offering-program">Program</Label>
              <Select
                value={selectedProgramId || undefined}
                onValueChange={setSelectedProgramId}
              >
                <SelectTrigger id="add-offering-program">
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  {createPrograms.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectedProgramId}
              onClick={continueAddOffering}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(duplicateTarget)}
        onOpenChange={(open) => {
          if (!open && !duplicating) {
            setDuplicateTarget(null)
            setDuplicateError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate offering</DialogTitle>
            <DialogDescription>
              Creates a copy using the existing duplicate workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="duplicate-offering-name">Name</Label>
            <Input
              id="duplicate-offering-name"
              value={duplicateName}
              onChange={(event) => setDuplicateName(event.target.value)}
            />
          </div>
          {duplicateError ? (
            <p className="text-sm text-destructive">{duplicateError}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={duplicating}
              onClick={() => setDuplicateTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={duplicating || !duplicateName.trim()}
              onClick={() => {
                if (!duplicateTarget) return
                void (async () => {
                  setDuplicating(true)
                  setDuplicateError(null)
                  try {
                    await duplicateProgramOffering(
                      duplicateTarget.id,
                      duplicateName.trim()
                    )
                    setDuplicateTarget(null)
                    showFeedback("Offering duplicated.")
                    router.refresh()
                  } catch (error) {
                    setDuplicateError(
                      error instanceof Error
                        ? error.message
                        : "Could not duplicate offering."
                    )
                  } finally {
                    setDuplicating(false)
                  }
                })()
              }}
            >
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-0.5 hover:text-foreground hover:underline",
        active && "font-medium text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function OfferingsTable({
  rows,
  sortKey,
  sortDirection,
  onSort,
  grouped = false,
  onDuplicate,
  onArchived,
}: {
  rows: OfferingsManagementRow[]
  sortKey: OfferingsManagementSortKey
  sortDirection: "asc" | "desc"
  onSort: (column: OfferingsManagementSortKey) => void
  grouped?: boolean
  onDuplicate: (row: OfferingsManagementRow) => void
  onArchived: () => void
}) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortButton
                label="Offering"
                column="offering"
                sortKey={sortKey}
                direction={sortDirection}
                onSort={onSort}
              />
            </TableHead>
            {grouped ? null : (
              <TableHead className="hidden sm:table-cell">
                <SortButton
                  label="Program"
                  column="program"
                  sortKey={sortKey}
                  direction={sortDirection}
                  onSort={onSort}
                />
              </TableHead>
            )}
            {grouped ? null : (
              <TableHead className="hidden lg:table-cell">
                <SortButton
                  label="Department"
                  column="department"
                  sortKey={sortKey}
                  direction={sortDirection}
                  onSort={onSort}
                />
              </TableHead>
            )}
            <TableHead className={grouped ? "hidden md:table-cell" : "hidden xl:table-cell"}>
              Primary Instructor
            </TableHead>
            <TableHead className="hidden lg:table-cell">Schedule</TableHead>
            <TableHead className="hidden md:table-cell">Fee</TableHead>
            <TableHead>
              <SortButton
                label="Enrollment"
                column="enrollment"
                sortKey={sortKey}
                direction={sortDirection}
                onSort={onSort}
              />
            </TableHead>
            <TableHead className="hidden md:table-cell">Registration</TableHead>
            <TableHead>
              <SortButton
                label="Status"
                column="status"
                sortKey={sortKey}
                direction={sortDirection}
                onSort={onSort}
              />
            </TableHead>
            <TableHead className="w-10 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="hover:bg-muted/40">
              <TableCell className="max-w-[16rem] py-2">
                <Link
                  href={row.offeringHref}
                  className="font-medium text-sky-700 hover:underline"
                >
                  {row.name}
                </Link>
                {grouped ? null : (
                  <p className="mt-0.5 truncate text-xs sm:hidden">
                    <Link
                      href={row.programHref}
                      className="text-sky-700 hover:underline"
                    >
                      {row.programName}
                    </Link>
                  </p>
                )}
              </TableCell>
              {grouped ? null : (
                <TableCell className="hidden max-w-[14rem] py-2 sm:table-cell">
                  <Link
                    href={row.programHref}
                    className="text-sky-700 hover:underline"
                  >
                    {row.programName}
                  </Link>
                </TableCell>
              )}
              {grouped ? null : (
                <TableCell className="hidden py-2 text-muted-foreground lg:table-cell">
                  {row.departmentName || "—"}
                </TableCell>
              )}
              <TableCell
                className={cn(
                  "py-2 text-muted-foreground",
                  grouped ? "hidden md:table-cell" : "hidden xl:table-cell"
                )}
              >
                {row.primaryInstructor || "—"}
              </TableCell>
              <TableCell className="hidden py-2 whitespace-nowrap text-muted-foreground lg:table-cell">
                {row.scheduleLabel || "—"}
              </TableCell>
              <TableCell className="hidden py-2 md:table-cell">
                {formatManagementFee(row)}
              </TableCell>
              <TableCell className="py-2 whitespace-nowrap">
                {formatManagementEnrollment(row)}
              </TableCell>
              <TableCell
                className={cn(
                  "hidden py-2 md:table-cell",
                  registrationClass(row.registrationState)
                )}
              >
                {OFFERING_REGISTRATION_STATE_LABELS[row.registrationState]}
              </TableCell>
              <TableCell className="py-2">
                <OfferingStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="py-2 text-right">
                <RowActions
                  row={row}
                  onDuplicate={onDuplicate}
                  onArchived={onArchived}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

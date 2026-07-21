import Link from "next/link"
import {
  Archive,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Tag,
  Users,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getDepartments } from "@/lib/departments/department-queries"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { getPrograms } from "@/lib/programs/program-queries"
import {
  getCatalogCapacityByProgramIds,
  getOfferingCountsByProgramIds,
} from "@/lib/programs/program-offering-queries"
import type { Program } from "@/lib/programs/program-types"
import type { ProgramStatus } from "@/lib/programs/program-status"
import { getProgramStatusLabel } from "@/lib/programs/program-status"
import {
  getProgramRegistrationAvailabilityLabel,
  isProgramAcceptingRegistration,
} from "@/lib/programs/program-enrollment-availability"
import { formatProgramAgeEligibility } from "@/lib/programs/program-eligibility-display"
import {
  catalogCapacityFromProgramTotal,
  formatEnrollmentCapacityLabel,
  getCatalogEnrollmentPercent,
  type ProgramCatalogCapacity,
} from "@/lib/programs/program-catalog-capacity"
import { ProgramCatalogFilters } from "@/components/programs/program-catalog-filters"
import { ProgramCardActions } from "@/components/programs/program-card-actions"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 8

const FLYER_PLACEHOLDER_COLORS = [
  "bg-sky-500",
  "bg-emerald-400",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-400",
  "bg-indigo-500",
] as const

type PageSearchParams = {
  q?: string
  status?: string
  department?: string
  view?: string
  page?: string
}

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function formatDate(value: string | null) {
  if (!value) return "TBD"

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getEnrollmentPercent(
  enrolled: number,
  capacity: ProgramCatalogCapacity
) {
  return getCatalogEnrollmentPercent(enrolled, capacity)
}

function getEnrollmentColor(
  enrolled: number,
  capacity: ProgramCatalogCapacity
) {
  const percent = getEnrollmentPercent(enrolled, capacity)

  if (percent >= 90) return "bg-red-500"
  if (percent >= 70) return "bg-amber-500"

  return "bg-emerald-500"
}

function matchesProgram(program: Program, filters: PageSearchParams) {
  const query = filters.q?.trim().toLowerCase()
  const status = filters.status || "all"
  const department = filters.department || "all"

  const matchesSearch =
    !query ||
    program.name.toLowerCase().includes(query) ||
    program.description?.toLowerCase().includes(query)

  const matchesStatus = status === "all" || program.status === status

  const matchesDepartment =
    department === "all" || program.department_id === department

  return matchesSearch && matchesStatus && matchesDepartment
}

function getStatusBadgeVariant(status: string) {
  switch (status as ProgramStatus) {
    case "active":
      return "default"
    case "paused":
      return "outline"
    default:
      return "secondary"
  }
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

function getFlyerPlaceholderColor(programId: string) {
  let hash = 0
  for (let index = 0; index < programId.length; index += 1) {
    hash = (hash + programId.charCodeAt(index) * (index + 1)) % 997
  }
  return FLYER_PLACEHOLDER_COLORS[hash % FLYER_PLACEHOLDER_COLORS.length]
}

function buildCatalogHref(filters: PageSearchParams, page: number) {
  const params = new URLSearchParams()
  if (filters.q?.trim()) params.set("q", filters.q.trim())
  if (filters.status && filters.status !== "all") params.set("status", filters.status)
  if (filters.department && filters.department !== "all") {
    params.set("department", filters.department)
  }
  if (filters.view === "table") params.set("view", "table")
  if (page > 1) params.set("page", String(page))
  const query = params.toString()
  return query ? `/programs/catalog?${query}` : "/programs/catalog"
}

function ProgramStatusBadge({ status }: { status: ProgramStatus }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        getStatusBadgeClass(status)
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", getStatusDotClass(status))} />
      {getProgramStatusLabel(status)}
    </Badge>
  )
}

function ProgramCard({
  program,
  offeringCount,
  catalogCapacity,
}: {
  program: Program
  offeringCount: number
  catalogCapacity: ProgramCatalogCapacity
}) {
  const percent = getEnrollmentPercent(program.enrolled, catalogCapacity)
  const acceptingRegistration = isProgramAcceptingRegistration(program)
  const availabilityLabel = getProgramRegistrationAvailabilityLabel(program)
  const ageLabel = formatProgramAgeEligibility(program)
  const audienceLabel = `${program.gender || "All"} • ${ageLabel}`
  const enrollmentLabel = formatEnrollmentCapacityLabel(
    program.enrolled,
    catalogCapacity
  )

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <div className="flex gap-4 p-4">
        <div
          className={cn(
            "relative aspect-square w-24 shrink-0 overflow-hidden rounded-lg sm:w-28",
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
              <ProgramStatusBadge status={program.status} />
            </div>
            <div className="relative shrink-0">
              <ProgramCardActions
                programId={program.id}
                programName={program.name}
                programStatus={program.status}
              />
            </div>
          </div>

          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                {formatDate(program.start_date)} - {formatDate(program.end_date)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0" />
              <span className="truncate">{audienceLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 shrink-0" />
              <span>
                {offeringCount} offering{offeringCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-muted-foreground">Enrollment</span>
              <span className="font-medium tabular-nums">
                {enrollmentLabel}
              </span>
            </div>

            <p
              className={cn(
                "mb-2 text-xs font-medium",
                acceptingRegistration
                  ? "text-emerald-700"
                  : "text-foreground/80"
              )}
            >
              {availabilityLabel}
            </p>

            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  acceptingRegistration
                    ? getEnrollmentColor(program.enrolled, catalogCapacity)
                    : "bg-muted-foreground/30"
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function ProgramsTable({
  programs,
  capacityByProgramId,
}: {
  programs: Program[]
  capacityByProgramId: Map<string, ProgramCatalogCapacity>
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Program</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Enrollment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[72px]">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {programs.map((program) => {
              const catalogCapacity =
                capacityByProgramId.get(program.id) ??
                catalogCapacityFromProgramTotal(program.capacity)
              return (
              <TableRow key={program.id}>
                <TableCell>
                  <p className="font-medium">{program.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {program.description || "No description"}
                  </p>
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {formatDate(program.start_date)} - {formatDate(program.end_date)}
                </TableCell>

                <TableCell>
                  {formatEnrollmentCapacityLabel(
                    program.enrolled,
                    catalogCapacity
                  )}
                </TableCell>

                <TableCell>
                  <Badge variant={getStatusBadgeVariant(program.status)}>
                    {getProgramStatusLabel(program.status)}
                  </Badge>
                </TableCell>

                <TableCell>
                  <ProgramCardActions
                    programId={program.id}
                    programName={program.name}
                    programStatus={program.status}
                  />
                </TableCell>
              </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function CatalogPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  filters,
}: {
  page: number
  totalPages: number
  totalCount: number
  pageSize: number
  filters: PageSearchParams
}) {
  if (totalCount === 0) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalCount)

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {start} to {end} of {totalCount} program
        {totalCount === 1 ? "" : "s"}
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page <= 1}
          asChild={page > 1}
        >
          {page > 1 ? (
            <Link href={buildCatalogHref(filters, page - 1)} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          ) : (
            <span>
              <ChevronLeft className="h-4 w-4" />
            </span>
          )}
        </Button>

        {Array.from({ length: totalPages }, (_, index) => {
          const pageNumber = index + 1
          const isActive = pageNumber === page
          return (
            <Button
              key={pageNumber}
              variant="outline"
              size="icon"
              className={cn(
                "h-8 w-8",
                isActive && "border-primary bg-primary/10 text-primary"
              )}
              asChild={!isActive}
              disabled={isActive}
            >
              {isActive ? (
                <span>{pageNumber}</span>
              ) : (
                <Link href={buildCatalogHref(filters, pageNumber)}>{pageNumber}</Link>
              )}
            </Button>
          )
        })}

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page >= totalPages}
          asChild={page < totalPages}
        >
          {page < totalPages ? (
            <Link href={buildCatalogHref(filters, page + 1)} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span>
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedSearchParams = await searchParams

  const filters: PageSearchParams = {
    q: getValue(resolvedSearchParams?.q) || "",
    status: getValue(resolvedSearchParams?.status) || "all",
    department: getValue(resolvedSearchParams?.department) || "all",
    view: getValue(resolvedSearchParams?.view) || "cards",
    page: getValue(resolvedSearchParams?.page) || "1",
  }

  const [programs, departments] = await Promise.all([
    getPrograms(),
    getDepartments(),
  ])
  const filteredPrograms = programs.filter((program) =>
    matchesProgram(program, filters)
  )
  const filteredIds = filteredPrograms.map((program) => program.id)
  const [offeringCounts, capacityByProgramId] = await Promise.all([
    getOfferingCountsByProgramIds(filteredIds),
    getCatalogCapacityByProgramIds(filteredIds),
  ])

  const viewMode = filters.view === "table" ? "table" : "cards"
  const totalCount = filteredPrograms.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const requestedPage = Math.max(1, Number.parseInt(filters.page || "1", 10) || 1)
  const page = Math.min(requestedPage, totalPages)
  const pagePrograms = filteredPrograms.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  )

  return (
    <>
      <Header title="Programs" />

      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Programs</h1>
            <p className="text-muted-foreground">
              Manage programs, classes, camps, and activities.
            </p>
          </div>

          <Button asChild>
            <Link href="/programs/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Program
            </Link>
          </Button>
        </div>

        <ProgramCatalogFilters
          departments={departments}
          initialFilters={{
            q: filters.q || "",
            status: filters.status || "all",
            department: filters.department || "all",
            view: viewMode,
          }}
        />

        {filteredPrograms.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12">
            <Archive className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-medium">No programs found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a program or adjust your filters.
            </p>

            <Button className="mt-4" asChild>
              <Link href="/programs/create">
                <Plus className="mr-2 h-4 w-4" />
                Create Program
              </Link>
            </Button>
          </Card>
        ) : viewMode === "table" ? (
          <>
            <ProgramsTable
              programs={pagePrograms}
              capacityByProgramId={capacityByProgramId}
            />
            <CatalogPagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={PAGE_SIZE}
              filters={filters}
            />
          </>
        ) : (
          <>
            <div className="grid gap-5 md:grid-cols-2">
              {pagePrograms.map((program) => (
                <ProgramCard
                  key={program.id}
                  program={program}
                  offeringCount={offeringCounts.get(program.id) || 0}
                  catalogCapacity={
                    capacityByProgramId.get(program.id) ??
                    catalogCapacityFromProgramTotal(program.capacity)
                  }
                />
              ))}
            </div>
            <CatalogPagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={PAGE_SIZE}
              filters={filters}
            />
          </>
        )}
      </div>
    </>
  )
}

import type { Program } from "@/lib/programs/program-types"
import type { ProgramStatus } from "@/lib/programs/program-status"
import {
  catalogCapacityFromProgramTotal,
  getCatalogEnrollmentPercent,
  type ProgramCatalogCapacity,
} from "@/lib/programs/program-catalog-capacity"

export const PROGRAM_CATALOG_PAGE_SIZE = 8

export const PROGRAM_CATALOG_FLYER_COLORS = [
  "bg-sky-500",
  "bg-emerald-400",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-400",
  "bg-indigo-500",
] as const

export type ProgramCatalogFilterValues = {
  q?: string
  status?: string
  department?: string
  gender?: string
  audience?: string
  age?: string
  view?: string
  page?: string
  kind?: string
}

export function formatProgramCatalogDate(value: string | null) {
  if (!value) return "TBD"

  // Date-only values (YYYY-MM-DD) must be formatted in UTC so US timezones
  // do not shift the calendar day backward.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (match) {
    const date = new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    )
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    })
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function getProgramCatalogEnrollmentPercent(
  enrolled: number,
  capacity: ProgramCatalogCapacity
) {
  return getCatalogEnrollmentPercent(enrolled, capacity)
}

export function getProgramCatalogEnrollmentColor(
  enrolled: number,
  capacity: ProgramCatalogCapacity
) {
  const percent = getProgramCatalogEnrollmentPercent(enrolled, capacity)

  if (percent >= 90) return "bg-red-500"
  if (percent >= 70) return "bg-amber-500"

  return "bg-emerald-500"
}

export function getProgramCatalogStatusBadgeVariant(status: string) {
  switch (status as ProgramStatus) {
    case "active":
      return "default" as const
    case "paused":
      return "outline" as const
    default:
      return "secondary" as const
  }
}

export function getProgramCatalogStatusBadgeClass(status: ProgramStatus) {
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

export function getProgramCatalogStatusDotClass(status: ProgramStatus) {
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

export function getProgramCatalogFlyerPlaceholderColor(programId: string) {
  let hash = 0
  for (let index = 0; index < programId.length; index += 1) {
    hash = (hash + programId.charCodeAt(index) * (index + 1)) % 997
  }
  return PROGRAM_CATALOG_FLYER_COLORS[
    hash % PROGRAM_CATALOG_FLYER_COLORS.length
  ]
}

export function matchesProgramCatalogFilters(
  program: Program,
  filters: ProgramCatalogFilterValues
) {
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

export function buildProgramCatalogHref(
  basePath: string,
  filters: ProgramCatalogFilterValues,
  page: number
) {
  const params = new URLSearchParams()
  if (filters.q?.trim()) params.set("q", filters.q.trim())
  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status)
  }
  if (filters.department && filters.department !== "all") {
    params.set("department", filters.department)
  }
  if (filters.gender && filters.gender !== "all") {
    params.set("gender", filters.gender)
  }
  if (filters.audience && filters.audience !== "all") {
    params.set("audience", filters.audience)
  }
  if (filters.age?.trim()) params.set("age", filters.age.trim())
  if (filters.kind === "academic" || filters.kind === "seasonal") {
    params.set("kind", filters.kind)
  }
  if (filters.view === "table") params.set("view", "table")
  if (page > 1) params.set("page", String(page))
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

export function resolveProgramCatalogCapacity(
  program: Program,
  capacityByProgramId: Map<string, ProgramCatalogCapacity> | Record<string, ProgramCatalogCapacity>
) {
  if (capacityByProgramId instanceof Map) {
    return (
      capacityByProgramId.get(program.id) ??
      catalogCapacityFromProgramTotal(program.capacity)
    )
  }
  return (
    capacityByProgramId[program.id] ??
    catalogCapacityFromProgramTotal(program.capacity)
  )
}

export function getProgramCatalogOfferingCount(
  programId: string,
  offeringCounts: Map<string, number> | Record<string, number>
) {
  if (offeringCounts instanceof Map) {
    return offeringCounts.get(programId) || 0
  }
  return offeringCounts[programId] || 0
}

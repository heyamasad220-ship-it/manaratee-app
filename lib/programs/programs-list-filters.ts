import { PROGRAMS_LIST_PATH } from "@/lib/programs/programs-module-nav"
import type { ProgramKind } from "@/lib/programs/program-kind"

export type ProgramsListFilters = {
  q: string
  department: string
  type: string
  status: string
}

export type ProgramsListFilterable = {
  id: string
  name: string
  program_kind: ProgramKind
  status: string
  department_id: string | null
}

export const DEFAULT_PROGRAMS_LIST_FILTERS: ProgramsListFilters = {
  q: "",
  department: "all",
  type: "all",
  status: "active",
}

export const PROGRAMS_LIST_STATUS_FILTER_ITEMS = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
] as const

export function parseProgramsListFilters(
  params: URLSearchParams | Record<string, string | string[] | undefined>
): ProgramsListFilters {
  const get = (key: string) => {
    if (params instanceof URLSearchParams) {
      return params.get(key) || ""
    }
    const value = params[key]
    return Array.isArray(value) ? value[0] || "" : value || ""
  }

  return {
    q: get("q"),
    department: get("department") || "all",
    type: get("type") || "all",
    status: get("status") || DEFAULT_PROGRAMS_LIST_FILTERS.status,
  }
}

export function buildProgramsListHref(filters: ProgramsListFilters) {
  const params = new URLSearchParams()
  if (filters.q.trim()) params.set("q", filters.q.trim())
  if (filters.department && filters.department !== "all") {
    params.set("department", filters.department)
  }
  if (filters.type && filters.type !== "all") {
    params.set("type", filters.type)
  }
  if (filters.status && filters.status !== DEFAULT_PROGRAMS_LIST_FILTERS.status) {
    params.set("status", filters.status)
  }
  const query = params.toString()
  return query ? `${PROGRAMS_LIST_PATH}?${query}` : PROGRAMS_LIST_PATH
}

export function programsListFiltersAreDefault(filters: ProgramsListFilters) {
  return (
    !filters.q.trim() &&
    filters.department === "all" &&
    filters.type === "all" &&
    filters.status === DEFAULT_PROGRAMS_LIST_FILTERS.status
  )
}

export function matchesProgramsListSearch(
  program: Pick<ProgramsListFilterable, "name">,
  departmentName: string | null,
  query: string
) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [program.name, departmentName || ""].join(" ").toLowerCase()
  return haystack.includes(q)
}

export function filterProgramsList<T extends ProgramsListFilterable>(
  programs: T[],
  departmentNameById: Record<string, string>,
  filters: ProgramsListFilters
) {
  return programs.filter((program) => {
    const departmentName = program.department_id
      ? departmentNameById[program.department_id] || ""
      : ""
    if (!matchesProgramsListSearch(program, departmentName, filters.q)) {
      return false
    }
    if (
      filters.department !== "all" &&
      program.department_id !== filters.department
    ) {
      return false
    }
    if (filters.type !== "all" && program.program_kind !== filters.type) {
      return false
    }
    if (filters.status !== "all" && program.status !== filters.status) {
      return false
    }
    return true
  })
}

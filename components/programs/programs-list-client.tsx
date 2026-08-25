"use client"

import * as React from "react"

import { ProgramsAllList } from "@/components/programs/programs-all-list"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ProgramListStats } from "@/lib/programs/program-offering-queries"
import { PROGRAM_KIND_TAG_LABELS, type ProgramKind } from "@/lib/programs/program-kind"
import type { Program } from "@/lib/programs/program-types"
import {
  buildProgramsListHref,
  DEFAULT_PROGRAMS_LIST_FILTERS,
  filterProgramsList,
  PROGRAMS_LIST_STATUS_FILTER_ITEMS,
  type ProgramsListFilters,
} from "@/lib/programs/programs-list-filters"

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

export function ProgramsListClient({
  programs,
  departments,
  statsByProgramId,
  createHref,
  initialFilters,
}: {
  programs: Program[]
  departments: Array<{ id: string; name: string }>
  statsByProgramId: Record<string, ProgramListStats>
  createHref: string | null
  initialFilters: ProgramsListFilters
}) {
  const departmentNameById = React.useMemo(
    () =>
      Object.fromEntries(
        departments.map((department) => [department.id, department.name])
      ),
    [departments]
  )

  const [filters, setFilters] = React.useState(initialFilters)
  const [query, setQuery] = React.useState(initialFilters.q)
  const filtersRef = React.useRef(filters)
  filtersRef.current = filters

  function syncUrl(nextFilters: ProgramsListFilters) {
    window.history.replaceState(
      window.history.state,
      "",
      buildProgramsListHref(nextFilters)
    )
  }

  function applyFilters(next: Partial<ProgramsListFilters>) {
    const merged = { ...filtersRef.current, ...next }
    filtersRef.current = merged
    setFilters(merged)
    syncUrl(merged)
  }

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (query === filtersRef.current.q) return
      applyFilters({ q: query })
    }, 250)
    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce query only
  }, [query])

  function clearFilters() {
    setQuery("")
    applyFilters({ ...DEFAULT_PROGRAMS_LIST_FILTERS })
  }

  const filtered = filterProgramsList(
    programs,
    departmentNameById,
    { ...filters, q: query }
  )
  const noProgramsExist = programs.length === 0
  const filtersHideResults = !noProgramsExist && filtered.length === 0

  return (
    <div className="space-y-4">
      {!noProgramsExist ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search programs..."
                aria-label="Search programs"
                className="h-8 bg-background"
              />
            </div>
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
              items={[...PROGRAMS_LIST_STATUS_FILTER_ITEMS]}
            />
          </div>
        </>
      ) : null}

      {filtersHideResults ? (
        <div className="rounded-lg border bg-card px-6 py-12 text-center">
          <h2 className="text-base font-semibold">
            No programs match these filters.
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
      ) : (
        <ProgramsAllList
          programs={filtered}
          departmentNameById={departmentNameById}
          statsByProgramId={statsByProgramId}
          createHref={createHref}
        />
      )}
    </div>
  )
}

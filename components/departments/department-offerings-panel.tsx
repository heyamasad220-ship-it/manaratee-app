"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import {
  ProgramCatalogFilters,
  type CatalogFilters,
} from "@/components/programs/program-catalog-filters"
import { ProgramCatalogView } from "@/components/programs/program-catalog-view"
import {
  matchesProgramCatalogFilters,
  PROGRAM_CATALOG_PAGE_SIZE,
} from "@/lib/programs/program-catalog-helpers"
import { fetchDepartmentProgramCatalogAction } from "@/lib/departments/department-program-catalog"
import type { ProgramCatalogCapacity } from "@/lib/programs/program-catalog-capacity"
import {
  PROGRAM_LABEL_PLURAL,
  YEAR_SEASON_LABEL,
  YEAR_SEASON_LABEL_PLURAL,
} from "@/lib/programs/program-display-labels"
import type { Program } from "@/lib/programs/program-types"

/**
 * Department Offerings tab = same Programs Catalog UI, locked to this department.
 * Opening a program uses the same detail / offering manage links as `/programs/catalog`.
 */
export function DepartmentOfferingsPanel({
  departmentId,
  departmentName,
}: {
  departmentId: string
  departmentName: string
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [offeringCounts, setOfferingCounts] = useState<Record<string, number>>(
    {}
  )
  const [capacityByProgramId, setCapacityByProgramId] = useState<
    Record<string, ProgramCatalogCapacity>
  >({})
  const [filters, setFilters] = useState<CatalogFilters>({
    q: "",
    status: "all",
    department: departmentId,
    gender: "all",
    audience: "all",
    age: "",
    view: "cards",
  })
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentProgramCatalogAction(departmentId)
    if (!result.success) {
      setError(result.error)
      setPrograms([])
      setOfferingCounts({})
      setCapacityByProgramId({})
      setLoading(false)
      return
    }
    setPrograms(result.programs)
    setOfferingCounts(result.offeringCounts)
    setCapacityByProgramId(result.capacityByProgramId)
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      department: departmentId,
    }))
    setPage(1)
  }, [departmentId])

  const filteredPrograms = useMemo(
    () =>
      programs.filter((program) =>
        matchesProgramCatalogFilters(program, {
          q: filters.q,
          status: filters.status,
          department: departmentId,
        })
      ),
    [programs, filters.q, filters.status, departmentId]
  )

  const totalCount = filteredPrograms.length
  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / PROGRAM_CATALOG_PAGE_SIZE)
  )
  const safePage = Math.min(page, totalPages)
  const pagePrograms = filteredPrograms.slice(
    (safePage - 1) * PROGRAM_CATALOG_PAGE_SIZE,
    safePage * PROGRAM_CATALOG_PAGE_SIZE
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading {YEAR_SEASON_LABEL_PLURAL.toLowerCase()}…
      </div>
    )
  }

  if (error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    )
  }

  return (
    <ProgramCatalogView
      programs={pagePrograms}
      offeringCounts={offeringCounts}
      capacityByProgramId={capacityByProgramId}
      viewMode={filters.view}
      page={safePage}
      totalPages={totalPages}
      totalCount={totalCount}
      pageSize={PROGRAM_CATALOG_PAGE_SIZE}
      onPageChange={setPage}
      createHref={`/programs/create?department=${departmentId}`}
      showTitle
      title={YEAR_SEASON_LABEL_PLURAL}
      description={`Same catalog as Programs → Catalog, filtered to ${departmentName}. Open a ${YEAR_SEASON_LABEL.toLowerCase()} to manage ${PROGRAM_LABEL_PLURAL.toLowerCase()}, fees, and registration.`}
      emptyTitle={`No ${YEAR_SEASON_LABEL_PLURAL.toLowerCase()} in this department`}
      emptyDescription={`Create a ${YEAR_SEASON_LABEL.toLowerCase()} for this department, or assign an existing ${YEAR_SEASON_LABEL.toLowerCase()}'s department in settings.`}
      filters={
        <ProgramCatalogFilters
          departments={[]}
          hideDepartmentFilter
          initialFilters={filters}
          onFiltersChange={(next) => {
            setFilters({
              ...next,
              department: departmentId,
            })
            setPage(1)
          }}
        />
      }
    />
  )
}

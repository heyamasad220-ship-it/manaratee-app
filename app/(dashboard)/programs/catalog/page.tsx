import { Header } from "@/components/layout/header"
import { ProgramCatalogFilters } from "@/components/programs/program-catalog-filters"
import { ProgramCatalogView } from "@/components/programs/program-catalog-view"
import { YEAR_SEASON_LABEL_PLURAL } from "@/lib/programs/program-display-labels"
import { getDepartments } from "@/lib/departments/department-queries"
import {
  buildProgramCatalogHref,
  matchesProgramCatalogFilters,
  PROGRAM_CATALOG_PAGE_SIZE,
} from "@/lib/programs/program-catalog-helpers"
import {
  getCatalogCapacityByProgramIds,
  getOfferingCountsByProgramIds,
} from "@/lib/programs/program-offering-queries"
import { getPrograms } from "@/lib/programs/program-queries"

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
    matchesProgramCatalogFilters(program, filters)
  )
  const filteredIds = filteredPrograms.map((program) => program.id)
  const [offeringCounts, capacityByProgramId] = await Promise.all([
    getOfferingCountsByProgramIds(filteredIds),
    getCatalogCapacityByProgramIds(filteredIds),
  ])

  const viewMode = filters.view === "table" ? "table" : "cards"
  const totalCount = filteredPrograms.length
  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / PROGRAM_CATALOG_PAGE_SIZE)
  )
  const requestedPage = Math.max(
    1,
    Number.parseInt(filters.page || "1", 10) || 1
  )
  const page = Math.min(requestedPage, totalPages)
  const pagePrograms = filteredPrograms.slice(
    (page - 1) * PROGRAM_CATALOG_PAGE_SIZE,
    page * PROGRAM_CATALOG_PAGE_SIZE
  )

  return (
    <>
      <Header title={YEAR_SEASON_LABEL_PLURAL} />

      <div className="p-6">
        <ProgramCatalogView
          programs={pagePrograms}
          offeringCounts={offeringCounts}
          capacityByProgramId={capacityByProgramId}
          viewMode={viewMode}
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={PROGRAM_CATALOG_PAGE_SIZE}
          buildPageHref={(targetPage) =>
            buildProgramCatalogHref("/programs/catalog", filters, targetPage)
          }
          filters={
            <ProgramCatalogFilters
              departments={departments}
              initialFilters={{
                q: filters.q || "",
                status: filters.status || "all",
                department: filters.department || "all",
                view: viewMode,
              }}
            />
          }
        />
      </div>
    </>
  )
}

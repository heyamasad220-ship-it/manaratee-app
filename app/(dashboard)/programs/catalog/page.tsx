import { Suspense } from "react"

import { Header } from "@/components/layout/header"
import { OfferingCatalogView } from "@/components/programs/offering-catalog-view"
import { ProgramCatalogFilters } from "@/components/programs/program-catalog-filters"
import { ProgramsSectionNav } from "@/components/programs/programs-section-nav"
import { getDepartments } from "@/lib/departments/department-queries"
import { getActiveOfferingsForCatalog } from "@/lib/programs/offering-catalog-queries"
import {
  buildProgramCatalogHref,
  PROGRAM_CATALOG_PAGE_SIZE,
} from "@/lib/programs/program-catalog-helpers"
import { PROGRAM_LABEL_PLURAL } from "@/lib/programs/program-display-labels"

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedSearchParams = await searchParams

  const filters = {
    q: getValue(resolvedSearchParams?.q) || "",
    department: getValue(resolvedSearchParams?.department) || "all",
    page: getValue(resolvedSearchParams?.page) || "1",
  }

  const [offerings, departments] = await Promise.all([
    getActiveOfferingsForCatalog({
      q: filters.q,
      department: filters.department,
    }),
    getDepartments(),
  ])

  const totalCount = offerings.length
  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / PROGRAM_CATALOG_PAGE_SIZE)
  )
  const requestedPage = Math.max(
    1,
    Number.parseInt(filters.page || "1", 10) || 1
  )
  const page = Math.min(requestedPage, totalPages)
  const pageOfferings = offerings.slice(
    (page - 1) * PROGRAM_CATALOG_PAGE_SIZE,
    page * PROGRAM_CATALOG_PAGE_SIZE
  )

  return (
    <>
      <Header title="Programs" />

      <Suspense fallback={null}>
        <ProgramsSectionNav />
      </Suspense>

      <div className="p-6">
        <OfferingCatalogView
          offerings={pageOfferings}
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={PROGRAM_CATALOG_PAGE_SIZE}
          title="Programs"
          emptyTitle={`No active ${PROGRAM_LABEL_PLURAL.toLowerCase()} found`}
          emptyDescription={`Add ${PROGRAM_LABEL_PLURAL.toLowerCase()} from a department workspace, or adjust your filters.`}
          buildPageHref={(targetPage) =>
            buildProgramCatalogHref(
              "/programs/catalog",
              {
                q: filters.q,
                status: "all",
                department: filters.department,
                view: "cards",
              },
              targetPage
            )
          }
          filters={
            <ProgramCatalogFilters
              departments={departments}
              hideStatusFilter
              hideViewToggle
              initialFilters={{
                q: filters.q || "",
                status: "active",
                department: filters.department || "all",
                view: "cards",
              }}
            />
          }
        />
      </div>
    </>
  )
}

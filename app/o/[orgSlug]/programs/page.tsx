import { notFound } from "next/navigation"
import Link from "next/link"

import { OfferingCatalogView } from "@/components/programs/offering-catalog-view"
import { ProgramCatalogFilters } from "@/components/programs/program-catalog-filters"
import {
  buildProgramCatalogHref,
  PROGRAM_CATALOG_PAGE_SIZE,
} from "@/lib/programs/program-catalog-helpers"
import { getPublicProgramCatalogBySlug } from "@/lib/programs/public-offering-catalog-queries"
import {
  buildPublicOfferingJoinHref,
  buildPublicProgramCatalogPath,
} from "@/lib/programs/public-paths"

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function PublicProgramCatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { orgSlug } = await params
  const resolvedSearchParams = await searchParams

  const filters = {
    q: getValue(resolvedSearchParams?.q) || "",
    department: getValue(resolvedSearchParams?.department) || "all",
    gender: getValue(resolvedSearchParams?.gender) || "all",
    audience: getValue(resolvedSearchParams?.audience) || "all",
    age: getValue(resolvedSearchParams?.age) || "",
    page: getValue(resolvedSearchParams?.page) || "1",
  }

  const catalog = await getPublicProgramCatalogBySlug(orgSlug, {
    q: filters.q,
    department: filters.department,
    gender: filters.gender,
    audience: filters.audience,
    age: filters.age,
  })

  if (!catalog.organization) {
    notFound()
  }

  const organization = catalog.organization
  const basePath = buildPublicProgramCatalogPath(organization.slug)
  const offerings = catalog.offerings
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
    <div className="min-h-screen bg-[#f5f5f7]">
      <header className="border-b bg-white/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <p className="text-sm font-medium text-foreground">
            {organization.name}
          </p>
          <p className="text-sm text-muted-foreground">
            Already a member?{" "}
            <Link href="/login" className="font-medium text-blue-700 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <OfferingCatalogView
          offerings={pageOfferings}
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={PROGRAM_CATALOG_PAGE_SIZE}
          title="Program Catalog"
          emptyTitle="No public programs right now"
          emptyDescription={`Check back later for open classes and activities from ${organization.name}.`}
          showStatus={false}
          getOfferingHref={(offering) =>
            buildPublicOfferingJoinHref(
              organization.slug,
              offering.program_id,
              offering.id
            )
          }
          buildPageHref={(targetPage) =>
            buildProgramCatalogHref(
              basePath,
              {
                q: filters.q,
                department: filters.department,
                gender: filters.gender,
                audience: filters.audience,
                age: filters.age,
                view: "cards",
              },
              targetPage
            )
          }
          filters={
            <ProgramCatalogFilters
              departments={catalog.departments}
              basePath={basePath}
              hideStatusFilter
              hideViewToggle
              showFamilyFilters
              initialFilters={{
                q: filters.q || "",
                status: "active",
                department: filters.department || "all",
                gender: filters.gender || "all",
                audience: filters.audience || "all",
                age: filters.age || "",
                view: "cards",
              }}
            />
          }
        />
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Selecting a program takes you to join or sign in before registration.
        </p>
      </div>
    </div>
  )
}

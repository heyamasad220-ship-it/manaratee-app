import { Header } from "@/components/layout/header"
import { CopyPublicCatalogLinkButton } from "@/components/programs/copy-public-catalog-link-button"
import { OfferingCatalogView } from "@/components/programs/offering-catalog-view"
import { ProgramCatalogFilters } from "@/components/programs/program-catalog-filters"
import { getDepartments } from "@/lib/departments/department-queries"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { getActiveOfferingsForCatalog } from "@/lib/programs/offering-catalog-queries"
import {
  buildProgramCatalogHref,
  PROGRAM_CATALOG_PAGE_SIZE,
} from "@/lib/programs/program-catalog-helpers"
import { PROGRAM_LABEL_PLURAL } from "@/lib/programs/program-display-labels"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import { buildPublicProgramCatalogUrl } from "@/lib/programs/public-paths"

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
    gender: getValue(resolvedSearchParams?.gender) || "all",
    audience: getValue(resolvedSearchParams?.audience) || "all",
    age: getValue(resolvedSearchParams?.age) || "",
    page: getValue(resolvedSearchParams?.page) || "1",
  }

  const organizationId = await getSelectedOrganizationId()
  let publicCatalogUrl: string | null = null
  if (organizationId) {
    const admin = getServiceRoleClient()
    const { data } = await admin
      .from("organizations")
      .select("slug")
      .eq("id", organizationId)
      .maybeSingle()
    if (data?.slug) {
      publicCatalogUrl = buildPublicProgramCatalogUrl(data.slug as string)
    }
  }

  const [offerings, departments] = await Promise.all([
    getActiveOfferingsForCatalog({
      q: filters.q,
      department: filters.department,
      gender: filters.gender,
      audience: filters.audience,
      age: filters.age,
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
      <Header title="Program Catalog" />

      <div className="space-y-4 p-6">
        {publicCatalogUrl ? (
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">Public catalog link</p>
              <p className="truncate text-xs text-muted-foreground">
                Share with families (no login required to browse). Only programs marked{" "}
                <span className="font-medium">public</span> appear.{" "}
                <span className="break-all">{publicCatalogUrl}</span>
              </p>
            </div>
            <CopyPublicCatalogLinkButton url={publicCatalogUrl} />
          </div>
        ) : null}

        <OfferingCatalogView
          offerings={pageOfferings}
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={PROGRAM_CATALOG_PAGE_SIZE}
          title="Program Catalog"
          emptyTitle={`No active ${PROGRAM_LABEL_PLURAL.toLowerCase()} found`}
          emptyDescription={`Add ${PROGRAM_LABEL_PLURAL.toLowerCase()} from a department workspace, or adjust your filters.`}
          getOfferingHref={(offering) =>
            programOfferingManageHref(offering.program_id, offering.id, {
              departmentId: offering.department_id,
            })
          }
          buildPageHref={(targetPage) =>
            buildProgramCatalogHref(
              "/programs/catalog",
              {
                q: filters.q,
                status: "all",
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
              departments={departments}
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
      </div>
    </>
  )
}

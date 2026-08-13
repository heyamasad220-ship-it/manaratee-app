import { cookies } from "next/headers"

import { OfferingCatalogView } from "@/components/programs/offering-catalog-view"
import { ProgramCatalogFilters } from "@/components/programs/program-catalog-filters"
import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import { getDepartments } from "@/lib/departments/department-queries"
import { userHasActiveMembership } from "@/lib/memberships/membership-queries"
import { getMyOrganizations } from "@/lib/organizations/get-my-organizations"
import { getActiveOfferingsForCatalog } from "@/lib/programs/offering-catalog-queries"
import {
  buildProgramCatalogHref,
  PROGRAM_CATALOG_PAGE_SIZE,
} from "@/lib/programs/program-catalog-helpers"

type CustomerOrganization = {
  organization_id: string
  organization_name: string
  role_name: string
}

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function getActiveCustomerOrganization() {
  const cookieStore = await cookies()
  const activeOrganizationId = cookieStore.get("active_organization_id")?.value

  const customerOrganizations = (await getMyOrganizations()) as CustomerOrganization[]

  if (customerOrganizations.length === 0) {
    return {
      organization: null as CustomerOrganization | null,
      errorMessage: "You are not connected to an organization yet.",
    }
  }

  const activeOrganization =
    customerOrganizations.find(
      (org) => org.organization_id === activeOrganizationId
    ) || customerOrganizations[0]

  return {
    organization: activeOrganization,
    errorMessage: null as string | null,
  }
}

export default async function CustomerProgramsPage({
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

  const { organization, errorMessage: organizationError } =
    await getActiveCustomerOrganization()

  let errorMessage = organizationError
  let offerings: Awaited<ReturnType<typeof getActiveOfferingsForCatalog>> = []
  let departments: Awaited<ReturnType<typeof getDepartments>> = []

  if (organization) {
    const { session } = await getCustomerPortalSupabase()
    const userId = session.effectiveUserId
    const hasMembership = userId
      ? await userHasActiveMembership(organization.organization_id, userId)
      : false

    try {
      offerings = await getActiveOfferingsForCatalog(
        {
          q: filters.q,
          department: filters.department,
          gender: filters.gender,
          audience: filters.audience,
          age: filters.age,
        },
        {
          customerVisibleOnly: true,
          hasMembership,
        }
      )
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Could not load programs."
      offerings = []
    }

    try {
      departments = await getDepartments()
    } catch {
      departments = []
    }
  }

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
    <div className="min-h-screen bg-[#f5f5f7] px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {errorMessage ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        <OfferingCatalogView
          offerings={pageOfferings}
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={PROGRAM_CATALOG_PAGE_SIZE}
          title="Program Catalog"
          emptyTitle="No programs match your filters"
          emptyDescription={`Explore classes and activities from ${
            organization?.organization_name || "your organization"
          }. Try clearing filters or check back later.`}
          showStatus={false}
          getOfferingHref={(offering) =>
            `/customer/programs/${offering.program_id}?offering=${offering.id}`
          }
          buildPageHref={(targetPage) =>
            buildProgramCatalogHref(
              "/customer/programs",
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
              departments={departments}
              basePath="/customer/programs"
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
    </div>
  )
}

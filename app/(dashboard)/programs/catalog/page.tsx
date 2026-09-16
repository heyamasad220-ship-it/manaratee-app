import { Header } from "@/components/layout/header"
import { OfferingsManagementPage } from "@/components/programs/offerings-management-page"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import {
  parseOfferingsManagementFilters,
  parseOfferingsManagementView,
} from "@/lib/programs/offerings-management"
import { getStaffOfferingsForManagement } from "@/lib/programs/offerings-management-queries"
import { getOpenPrograms } from "@/lib/programs/program-queries"
import { buildPublicProgramCatalogUrl } from "@/lib/programs/public-paths"
import { redirectOrgWideProgramPagesForDepartmentHead } from "@/lib/programs/program-access"

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function ProgramsOfferingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await redirectOrgWideProgramPagesForDepartmentHead()
  const resolvedSearchParams = await searchParams
  const filters = parseOfferingsManagementFilters(resolvedSearchParams || {})
  const urlView = parseOfferingsManagementView(
    getValue(resolvedSearchParams?.view)
  )

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

  const [rows, programs] = await Promise.all([
    getStaffOfferingsForManagement(),
    getOpenPrograms(),
  ])

  const createPrograms = programs
    .map((program) => ({
      id: program.id,
      name: program.name,
      departmentId: program.department_id,
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  return (
    <>
      <Header title="Offerings" />
      <div className="p-6">
        <OfferingsManagementPage
          rows={rows}
          createPrograms={createPrograms}
          publicCatalogUrl={publicCatalogUrl}
          initialFilters={filters}
          initialView={urlView || "table"}
          urlHasView={Boolean(urlView)}
        />
      </div>
    </>
  )
}

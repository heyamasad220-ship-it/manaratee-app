import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { ApplicationsModulePage } from "@/components/applications/applications-module-page"
import { moduleOwnerFromScope } from "@/lib/applications/application-nav"
import { peopleManagementApplicationsUrl } from "@/lib/applications/application-routes"
import { statusTabIdFromQueryParam } from "@/lib/applications/application-status-tabs"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"
import type { ModuleOwner } from "@/lib/applications/application-types"

export default async function ApplicationsAllPage({
  searchParams,
}: {
  searchParams: Promise<{
    module_owner?: string
    application_type?: string
    status?: string
  }>
}) {
  await requirePermission(PERMISSIONS.APPLICATIONS_VIEW)
  const params = await searchParams

  const moduleOwner = moduleOwnerFromScope(
    params.module_owner as ModuleOwner | undefined,
    params.application_type
  )

  if (!params.application_type && (!params.module_owner || params.module_owner === "hr")) {
    redirect(
      peopleManagementApplicationsUrl({
        status: statusTabIdFromQueryParam(params.status),
        applicationType: params.application_type,
      })
    )
  }

  if (!moduleOwner || moduleOwner === "hr") {
    redirect(
      peopleManagementApplicationsUrl({
        status: statusTabIdFromQueryParam(params.status),
        applicationType: params.application_type,
      })
    )
  }

  const title =
    params.application_type === "vendor"
      ? "Vendor Applications"
      : params.application_type === "financial_aid"
        ? "Financial Assistance"
        : "Applications"

  return (
    <>
      <Header title={title} />
      <Suspense>
        <ApplicationsModulePage
          moduleOwner={moduleOwner}
          basePath="/applications/all"
          title={title}
        />
      </Suspense>
    </>
  )
}

import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { ApplicationsModulePage } from "@/components/applications/applications-module-page"
import { moduleOwnerFromScope } from "@/lib/applications/application-nav"
import {
  peopleManagementApplicationsUrl,
  programsFinancialAssistanceUrl,
  vendorApplicationsUrl,
} from "@/lib/applications/application-routes"
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
  const statusTab = statusTabIdFromQueryParam(params.status)

  if (params.application_type === "vendor") {
    redirect(
      vendorApplicationsUrl({
        pageTab: "submissions",
        status: statusTab,
        applicationType: params.application_type,
      })
    )
  }

  if (params.application_type === "financial_aid") {
    redirect(
      programsFinancialAssistanceUrl({
        pageTab: "submissions",
        status: statusTab,
        applicationType: params.application_type,
      })
    )
  }

  const moduleOwner = moduleOwnerFromScope(
    params.module_owner as ModuleOwner | undefined,
    params.application_type
  )

  if (!params.application_type && (!params.module_owner || params.module_owner === "hr")) {
    redirect(
      peopleManagementApplicationsUrl({
        status: statusTab,
        applicationType: params.application_type,
      })
    )
  }

  if (params.module_owner === "vendor_hub") {
    redirect(vendorApplicationsUrl({ pageTab: statusTab ? "submissions" : undefined, status: statusTab }))
  }

  if (params.module_owner === "programs") {
    redirect(
      programsFinancialAssistanceUrl({ pageTab: statusTab ? "submissions" : undefined, status: statusTab })
    )
  }

  if (!moduleOwner || moduleOwner === "hr") {
    redirect(
      peopleManagementApplicationsUrl({
        status: statusTab,
        applicationType: params.application_type,
      })
    )
  }

  const title = "Applications"

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

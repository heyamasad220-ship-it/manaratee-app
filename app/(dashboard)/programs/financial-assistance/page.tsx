import { Suspense } from "react"
import { Header } from "@/components/layout/header"
import { ModuleApplicationsClient } from "@/components/applications/module-applications-client"
import { PROGRAMS_FINANCIAL_ASSISTANCE_PATH } from "@/lib/applications/application-routes"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function ProgramsFinancialAssistancePage() {
  await requirePermission(PERMISSIONS.APPLICATIONS_VIEW)

  return (
    <>
      <Header title="Financial Assistance" />
      <Suspense>
        <ModuleApplicationsClient
          moduleOwner="programs"
          basePath={PROGRAMS_FINANCIAL_ASSISTANCE_PATH}
          title="Financial Assistance"
          lockedApplicationType="financial_aid"
          hubApplicationTypes={["financial_aid"]}
        />
      </Suspense>
    </>
  )
}

import { Suspense } from "react"
import { Header } from "@/components/layout/header"
import { ModuleApplicationsClient } from "@/components/applications/module-applications-client"
import { FinancialAssistanceOverviewPanel } from "@/components/programs/financial-assistance-overview-panel"
import { PROGRAMS_FINANCIAL_ASSISTANCE_PATH } from "@/lib/applications/application-routes"
import {
  hasPermission,
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions/permissions"
import { getProgramsFinancialAssistanceSettings } from "@/lib/programs/program-financial-assistance-actions"

export default async function ProgramsFinancialAssistancePage() {
  await requirePermission(PERMISSIONS.APPLICATIONS_VIEW)

  const [programs, canManage] = await Promise.all([
    getProgramsFinancialAssistanceSettings(),
    hasPermission(PERMISSIONS.PROGRAMS_MANAGE),
  ])

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
          overviewLeadingContent={
            <FinancialAssistanceOverviewPanel
              initialPrograms={programs}
              canManage={canManage}
            />
          }
        />
      </Suspense>
    </>
  )
}

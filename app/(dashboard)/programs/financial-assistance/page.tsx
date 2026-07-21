import { Suspense } from "react"
import { Header } from "@/components/layout/header"
import { ProgramsFinancialAssistanceClient } from "@/components/programs/programs-financial-assistance-client"
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
        <ProgramsFinancialAssistanceClient
          initialPrograms={programs}
          canManage={canManage}
        />
      </Suspense>
    </>
  )
}

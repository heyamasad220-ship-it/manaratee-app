import { Suspense } from "react"

import { Header } from "@/components/layout/header"
import { ProgramsFinancialAssistanceClient } from "@/components/programs/programs-financial-assistance-client"
import { FINANCE_FINANCIAL_ASSISTANCE_PATH } from "@/lib/finance/finance-paths"
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/permissions/permissions"
import { getProgramsFinancialAssistanceSettings } from "@/lib/programs/program-financial-assistance-actions"
import { redirect } from "next/navigation"

export default async function FinanceFinancialAssistancePage() {
  const canView =
    (await hasPermission(PERMISSIONS.FINANCE_VIEW)) ||
    (await hasPermission(PERMISSIONS.APPLICATIONS_VIEW))
  if (!canView) {
    redirect("/unauthorized")
  }

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
          basePath={FINANCE_FINANCIAL_ASSISTANCE_PATH}
        />
      </Suspense>
    </>
  )
}

"use client"

import { CreditCard, HeartHandshake } from "lucide-react"
import { ModuleApplicationsClient } from "@/components/applications/module-applications-client"
import { FinancialAssistanceOverviewPanel } from "@/components/programs/financial-assistance-overview-panel"
import {
  FinancialAssistanceReportPanel,
  PaymentPlansReportPanel,
} from "@/components/programs/programs-fa-report-panels"
import { PROGRAMS_FINANCIAL_ASSISTANCE_PATH } from "@/lib/applications/application-routes"
import type { ProgramFinancialAssistanceSettings } from "@/lib/programs/program-financial-assistance-actions"

export function ProgramsFinancialAssistanceClient({
  initialPrograms,
  canManage,
}: {
  initialPrograms: ProgramFinancialAssistanceSettings[]
  canManage: boolean
}) {
  return (
    <ModuleApplicationsClient
      moduleOwner="programs"
      basePath={PROGRAMS_FINANCIAL_ASSISTANCE_PATH}
      title="Financial Assistance"
      lockedApplicationType="financial_aid"
      hubApplicationTypes={["financial_aid"]}
      overviewLeadingContent={
        <FinancialAssistanceOverviewPanel
          initialPrograms={initialPrograms}
          canManage={canManage}
        />
      }
      extraTabs={[
        {
          value: "financial-assistance",
          label: "Financial Assistance",
          icon: HeartHandshake,
          content: <FinancialAssistanceReportPanel />,
        },
        {
          value: "payment-plans",
          label: "Payment Plans",
          icon: CreditCard,
          content: <PaymentPlansReportPanel />,
        },
      ]}
    />
  )
}

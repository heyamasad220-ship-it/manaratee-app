"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CreditCard, FileBarChart } from "lucide-react"
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
  const router = useRouter()
  const searchParams = useSearchParams()

  React.useEffect(() => {
    if (searchParams.get("tab") === "financial-assistance") {
      const next = new URLSearchParams(searchParams.toString())
      next.set("tab", "reports")
      router.replace(`${PROGRAMS_FINANCIAL_ASSISTANCE_PATH}?${next.toString()}`)
    }
  }, [router, searchParams])

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
          value: "reports",
          label: "Reports",
          icon: FileBarChart,
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

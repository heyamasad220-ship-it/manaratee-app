"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FileBarChart } from "lucide-react"
import { ModuleApplicationsClient } from "@/components/applications/module-applications-client"
import { FinancialAssistanceOverviewPanel } from "@/components/programs/financial-assistance-overview-panel"
import { FinancialAssistanceReportPanel } from "@/components/programs/programs-fa-report-panels"
import { PROGRAMS_FINANCIAL_ASSISTANCE_PATH } from "@/lib/applications/application-routes"
import { FINANCE_FINANCIAL_ASSISTANCE_PATH } from "@/lib/finance/finance-paths"
import type { ProgramFinancialAssistanceSettings } from "@/lib/programs/program-financial-assistance-actions"

const TUITION_PLANS_PATH = "/programs/reports/tuition-plans"

export function ProgramsFinancialAssistanceClient({
  initialPrograms,
  canManage,
  basePath = FINANCE_FINANCIAL_ASSISTANCE_PATH,
}: {
  initialPrograms: ProgramFinancialAssistanceSettings[]
  canManage: boolean
  /** Canonical FA hub path (Finance). Legacy Programs path still accepted. */
  basePath?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resolvedBasePath =
    basePath ||
    FINANCE_FINANCIAL_ASSISTANCE_PATH ||
    PROGRAMS_FINANCIAL_ASSISTANCE_PATH

  React.useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "payment-plans") {
      router.replace(TUITION_PLANS_PATH)
      return
    }
    if (tab === "financial-assistance") {
      const next = new URLSearchParams(searchParams.toString())
      next.set("tab", "reports")
      router.replace(`${resolvedBasePath}?${next.toString()}`)
    }
  }, [router, searchParams, resolvedBasePath])

  return (
    <ModuleApplicationsClient
      moduleOwner="programs"
      basePath={resolvedBasePath}
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
      ]}
    />
  )
}

import { redirect } from "next/navigation"

import { HrOverviewRoutePage } from "@/components/hr/hr-overview-route-page"
import { FINANCE_PAYROLL_PATH } from "@/lib/finance/finance-paths"
import {
  hrOverviewHref,
  parseHrOverviewTab,
} from "@/lib/hr/hr-overview-path"

export default async function WorkforceOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  if (tab === "payroll") {
    redirect(FINANCE_PAYROLL_PATH)
  }
  // Legacy `?tab=` deep links → path-based HR sections.
  if (tab && tab !== "overview") {
    const next = parseHrOverviewTab(tab)
    if (next !== "overview") {
      redirect(hrOverviewHref({ tab: next }))
    }
  }

  return <HrOverviewRoutePage initialTab="overview" />
}

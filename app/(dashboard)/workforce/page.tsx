import { redirect } from "next/navigation"

import { FINANCE_PAYROLL_PATH } from "@/lib/finance/finance-paths"
import {
  HR_EMPLOYEES_PATH,
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
  // Legacy `?tab=` deep links → path-based Workforce sections.
  if (tab) {
    const next = parseHrOverviewTab(tab)
    redirect(hrOverviewHref({ tab: next }))
  }

  // Workforce lands on Employees (Overview tab removed).
  redirect(HR_EMPLOYEES_PATH)
}

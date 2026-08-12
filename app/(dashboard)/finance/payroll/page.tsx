import { Suspense } from "react"

import { Header } from "@/components/layout/header"
import { FinancePayrollQueuePanel } from "@/components/finance/finance-payroll-queue-panel"
import { ProgramsReportsNav } from "@/components/programs/programs-reports-nav"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { redirect } from "next/navigation"

export default async function FinancePayrollPage() {
  const canView =
    (await hasPermission(PERMISSIONS.FINANCE_VIEW)) ||
    (await hasPermission(PERMISSIONS.STAFF_VIEW))
  if (!canView) {
    redirect("/unauthorized")
  }

  return (
    <>
      <Header title="Reports" />

      <Suspense fallback={null}>
        <ProgramsReportsNav />
      </Suspense>

      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organization payout queue. Department heads approve hours in their
            department workspace; finance marks paid here.
          </p>
        </div>
        <FinancePayrollQueuePanel />
      </div>
    </>
  )
}

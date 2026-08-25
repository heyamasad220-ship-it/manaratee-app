import { Suspense } from "react"

import { Header } from "@/components/layout/header"
import { ProgramsStaffSubnav } from "@/components/programs/programs-staff-subnav"
import { OrgReportsClient } from "@/components/reports/org-reports-client"
import { FINANCE_TRANSACTIONS_PATH } from "@/lib/finance/finance-paths"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { redirect } from "next/navigation"

export default async function FinanceTransactionsPage() {
  const canView =
    (await hasPermission(PERMISSIONS.FINANCE_VIEW)) ||
    (await hasPermission(PERMISSIONS.REPORTS_VIEW))
  if (!canView) {
    redirect("/unauthorized")
  }

  return (
    <>
      <Header title="Finance" />
      <ProgramsStaffSubnav secondary="finance" requireProgramsModule />

      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organization-wide payment activity across donations and programs.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="rounded-lg border px-4 py-10 text-center text-sm text-muted-foreground">
              Loading transactions…
            </div>
          }
        >
          <OrgReportsClient basePath={FINANCE_TRANSACTIONS_PATH} />
        </Suspense>
      </div>
    </>
  )
}

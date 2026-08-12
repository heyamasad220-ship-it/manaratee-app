import { Suspense } from "react"
import { redirect } from "next/navigation"

import { Header } from "@/components/layout/header"
import { PaymentSummaryReportPanel } from "@/components/programs/payment-summary-report-panel"
import { ProgramsReportsNav } from "@/components/programs/programs-reports-nav"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"

export default async function ProgramsPaymentSummaryReportPage() {
  const canView =
    (await hasPermission(PERMISSIONS.PROGRAMS_VIEW)) ||
    (await hasPermission(PERMISSIONS.REPORTS_VIEW)) ||
    (await hasPermission(PERMISSIONS.FINANCE_VIEW))
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
          <h1 className="text-2xl font-semibold tracking-tight">
            Payment Summary
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Family registration balances, program fees, and additional charges.
          </p>
        </div>
        <PaymentSummaryReportPanel />
      </div>
    </>
  )
}

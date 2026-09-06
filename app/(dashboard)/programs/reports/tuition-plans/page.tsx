import { Suspense } from "react"
import { redirect } from "next/navigation"

import { Header } from "@/components/layout/header"
import { PaymentSummaryReportPanel } from "@/components/programs/payment-summary-report-panel"
import { ProgramsStaffSubnav } from "@/components/programs/programs-staff-subnav"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { redirectOrgWideProgramPagesForDepartmentHead } from "@/lib/programs/program-access"

export default async function ProgramsPaymentSummaryReportPage() {
  await redirectOrgWideProgramPagesForDepartmentHead()
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
      <ProgramsStaffSubnav secondary="reports" />

      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Payment Summary
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Family registration balances, program fees, and additional charges.
          </p>
        </div>
        <Suspense fallback={null}>
          <PaymentSummaryReportPanel />
        </Suspense>
      </div>
    </>
  )
}

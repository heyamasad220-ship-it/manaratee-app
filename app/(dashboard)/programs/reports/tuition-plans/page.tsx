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

      <div className="px-6 pb-6">
        <Suspense fallback={null}>
          <PaymentSummaryReportPanel />
        </Suspense>
      </div>
    </>
  )
}

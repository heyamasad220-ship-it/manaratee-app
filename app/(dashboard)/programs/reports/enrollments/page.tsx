import { Suspense } from "react"
import { redirect } from "next/navigation"

import { Header } from "@/components/layout/header"
import { EnrollmentsReportTable } from "@/components/programs/enrollments-report-table"
import { ProgramsStaffSubnav } from "@/components/programs/programs-staff-subnav"
import { getEnrollmentsReportRows } from "@/lib/programs/enrollments-report"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { redirectOrgWideProgramPagesForDepartmentHead } from "@/lib/programs/program-access"

export default async function ProgramsEnrollmentsReportPage() {
  await redirectOrgWideProgramPagesForDepartmentHead()
  const canView =
    (await hasPermission(PERMISSIONS.PROGRAMS_VIEW)) ||
    (await hasPermission(PERMISSIONS.REPORTS_VIEW))
  if (!canView) {
    redirect("/unauthorized")
  }

  const result = await getEnrollmentsReportRows()

  return (
    <>
      <Header title="Reports" />
      <ProgramsStaffSubnav secondary="reports" />

      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Enrollments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One row per participant with demographics, consent, and enrollment
            status.
          </p>
        </div>

        {result.success ? (
          <Suspense fallback={null}>
            <EnrollmentsReportTable rows={result.rows} />
          </Suspense>
        ) : (
          <p className="text-sm text-destructive">{result.error}</p>
        )}
      </div>
    </>
  )
}

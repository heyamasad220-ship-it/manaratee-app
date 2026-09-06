import { Suspense } from "react"
import { redirect } from "next/navigation"

import { Header } from "@/components/layout/header"
import { CampEnrollmentReport } from "@/components/programs/camp-enrollment-report"
import { ProgramsStaffSubnav } from "@/components/programs/programs-staff-subnav"
import { getCampEnrollmentFacts } from "@/lib/programs/camp-enrollment-queries"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { redirectOrgWideProgramPagesForDepartmentHead } from "@/lib/programs/program-access"

export default async function ProgramsCampEnrollmentReportPage() {
  await redirectOrgWideProgramPagesForDepartmentHead()
  const canView =
    (await hasPermission(PERMISSIONS.PROGRAMS_VIEW)) ||
    (await hasPermission(PERMISSIONS.REPORTS_VIEW))
  if (!canView) {
    redirect("/unauthorized")
  }

  const result = await getCampEnrollmentFacts()

  return (
    <>
      <Header title="Reports" />
      <ProgramsStaffSubnav secondary="reports" />

      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Camp enrollment
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Household participation across camp seasons. Camp 1 and Camp 2
            count as two programs, even when the operational year is one
            Summer Camp.
          </p>
        </div>

        {result.success ? (
          <Suspense fallback={null}>
            <CampEnrollmentReport facts={result.facts} />
          </Suspense>
        ) : (
          <p className="text-sm text-destructive">{result.error}</p>
        )}
      </div>
    </>
  )
}

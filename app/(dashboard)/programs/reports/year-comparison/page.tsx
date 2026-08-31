import { Suspense } from "react"
import { redirect } from "next/navigation"

import { Header } from "@/components/layout/header"
import { ProgramsStaffSubnav } from "@/components/programs/programs-staff-subnav"
import { YearComparisonReport } from "@/components/programs/year-comparison-report"
import { getYearComparisonFacts } from "@/lib/programs/year-comparison-queries"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"

export default async function ProgramsYearComparisonReportPage() {
  const canView =
    (await hasPermission(PERMISSIONS.PROGRAMS_VIEW)) ||
    (await hasPermission(PERMISSIONS.REPORTS_VIEW))
  if (!canView) {
    redirect("/unauthorized")
  }

  const result = await getYearComparisonFacts()

  return (
    <>
      <Header title="Reports" />
      <ProgramsStaffSubnav secondary="reports" />

      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Year comparison</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enrollment growth by program and department — unique participants
            and families, with new vs returning from the previous year.
          </p>
        </div>

        {result.success ? (
          <Suspense fallback={null}>
            <YearComparisonReport facts={result.facts} />
          </Suspense>
        ) : (
          <p className="text-sm text-destructive">{result.error}</p>
        )}
      </div>
    </>
  )
}

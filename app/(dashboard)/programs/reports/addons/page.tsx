import { Suspense } from "react"
import { redirect } from "next/navigation"

import { Header } from "@/components/layout/header"
import { AddonsReportTable } from "@/components/programs/addons-report-table"
import { ProgramsReportsNav } from "@/components/programs/programs-reports-nav"
import { getAddonReportRows } from "@/lib/programs/addons-report"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"

export default async function ProgramsAddonsReportPage() {
  const canView =
    (await hasPermission(PERMISSIONS.PROGRAMS_VIEW)) ||
    (await hasPermission(PERMISSIONS.REPORTS_VIEW))
  if (!canView) {
    redirect("/unauthorized")
  }

  const result = await getAddonReportRows()

  return (
    <>
      <Header title="Reports" />

      <Suspense fallback={null}>
        <ProgramsReportsNav />
      </Suspense>

      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Add-ons</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One row per purchased add-on — materials, lunch, uniforms, field
            trips, and other extras.
          </p>
        </div>

        {result.success ? (
          <Suspense fallback={null}>
            <AddonsReportTable rows={result.rows} />
          </Suspense>
        ) : (
          <p className="text-sm text-destructive">{result.error}</p>
        )}
      </div>
    </>
  )
}

import { Suspense } from "react"

import { Header } from "@/components/layout/header"
import { OrgReportsClient } from "@/components/reports/org-reports-client"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function OrganizationReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requirePermission(PERMISSIONS.REPORTS_VIEW)
  const { tab } = await searchParams

  return (
    <>
      <Header title="Reports" />
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organization-wide payment activity and other cross-module reports.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="rounded-lg border px-4 py-10 text-center text-sm text-muted-foreground">
              Loading reports…
            </div>
          }
        >
          <OrgReportsClient initialTab={tab} />
        </Suspense>
      </div>
    </>
  )
}

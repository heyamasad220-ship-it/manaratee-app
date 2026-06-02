import { Suspense } from "react"
import { Header } from "@/components/layout/header"
import { ApplicationsOverviewClient } from "@/components/applications/applications-overview-client"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function ApplicationsOverviewPage() {
  await requirePermission(PERMISSIONS.APPLICATIONS_VIEW)

  return (
    <>
      <Header title="Applications" />
      <Suspense>
        <ApplicationsOverviewClient />
      </Suspense>
    </>
  )
}

import { Header } from "@/components/layout/header"
import { ApplicationsReportsClient } from "@/components/applications/applications-reports-client"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function ApplicationsReportsPage() {
  await requirePermission(PERMISSIONS.APPLICATIONS_VIEW)

  return (
    <>
      <Header title="Application Reports" />
      <ApplicationsReportsClient />
    </>
  )
}

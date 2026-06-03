import { Suspense } from "react"
import { Header } from "@/components/layout/header"
import { ModuleApplicationsClient } from "@/components/applications/module-applications-client"
import { VENDOR_HUB_APPLICATIONS_PATH } from "@/lib/applications/application-routes"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function VendorHubApplicationsPage() {
  await requirePermission(PERMISSIONS.APPLICATIONS_VIEW)

  return (
    <>
      <Header title="Vendor Applications" />
      <Suspense>
        <ModuleApplicationsClient
          moduleOwner="vendor_hub"
          basePath={VENDOR_HUB_APPLICATIONS_PATH}
          title="Vendor Applications"
          lockedApplicationType="vendor"
          hubApplicationTypes={["vendor"]}
        />
      </Suspense>
    </>
  )
}

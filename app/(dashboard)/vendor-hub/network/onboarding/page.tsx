import { Suspense } from "react"

import { ModuleApplicationsClient } from "@/components/applications/module-applications-client"
import { CopyVendorApplyLinkButton } from "@/components/vendor-hub/network/copy-vendor-apply-link-button"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

export default async function VendorNetworkOnboardingPage() {
  await requireVendorHubManage()
  await requirePermission(PERMISSIONS.APPLICATIONS_VIEW)

  return (
    <Suspense>
      <ModuleApplicationsClient
        moduleOwner="vendor_hub"
        basePath={VENDOR_HUB_ROUTES.network.onboarding}
        title="Vendor onboarding"
        lockedApplicationType="vendor"
        hubApplicationTypes={["vendor"]}
        showOverviewTab={false}
        headerAction={<CopyVendorApplyLinkButton />}
      />
    </Suspense>
  )
}

import { Suspense } from "react"

import { ModuleApplicationsClient } from "@/components/applications/module-applications-client"
import { CopyVendorApplyLinkButton } from "@/components/vendor-hub/network/copy-vendor-apply-link-button"
import { Card, CardContent } from "@/components/ui/card"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

export default async function VendorNetworkOnboardingPage() {
  await requireVendorHubManage()
  await requirePermission(PERMISSIONS.APPLICATIONS_VIEW)

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Vendors apply once to the organization (not per bazaar). Share the apply link, then
            review submissions here. Approve to add them to the Vendor Network.
          </p>
          <CopyVendorApplyLinkButton />
        </CardContent>
      </Card>
      <Suspense>
        <ModuleApplicationsClient
          moduleOwner="vendor_hub"
          basePath={VENDOR_HUB_ROUTES.network.onboarding}
          title="Vendor onboarding"
          lockedApplicationType="vendor"
          hubApplicationTypes={["vendor"]}
        />
      </Suspense>
    </div>
  )
}

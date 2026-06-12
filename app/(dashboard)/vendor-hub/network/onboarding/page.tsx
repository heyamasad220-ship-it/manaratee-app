import { Suspense } from "react"

import { ModuleApplicationsClient } from "@/components/applications/module-applications-client"
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
        <CardContent className="p-4 text-sm text-muted-foreground">
          Applications are organization-scoped — not tied to a single bazaar event. Booth
          reservations for each event appear under that event&apos;s Reservations tab.
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

import { Suspense } from "react"

import { VendorHubReportsClient } from "@/components/vendor-hub/vendor-hub-reports-client"
import { getVendorHubReportsData } from "@/lib/vendor-hub/vendor-hub-reports-queries"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function BazaarReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string }>
}) {
  await requirePermission(PERMISSIONS.REPORTS_VIEW)

  const params = await searchParams
  const eventId = params.eventId?.trim() || "all"
  const data = await getVendorHubReportsData(eventId === "all" ? null : eventId)

  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading reports…</div>}>
      <VendorHubReportsClient initialData={data} initialEventId={eventId} />
    </Suspense>
  )
}

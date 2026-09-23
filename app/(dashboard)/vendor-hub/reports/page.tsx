import { redirect } from "next/navigation"
import { Suspense } from "react"

import { VendorHubReportsClient } from "@/components/vendor-hub/vendor-hub-reports-client"
import { getBoothOrders } from "@/lib/vendor-hub/booth-orders-queries"
import { getParticipationHistory } from "@/lib/vendor-hub/participation-history-queries"
import { getVendorHubReportsData } from "@/lib/vendor-hub/vendor-hub-reports-queries"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function BazaarReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string; tab?: string; contact?: string }>
}) {
  await requirePermission(PERMISSIONS.REPORTS_VIEW)

  const params = await searchParams
  const tab = (params.tab || "").trim().toLowerCase()
  if (tab === "overview") {
    redirect(VENDOR_HUB_ROUTES.overview)
  }

  const eventId = params.eventId?.trim() || "all"
  const contact = params.contact?.trim() || null
  const scopedEventId = eventId === "all" ? null : eventId
  const [data, historyRows, boothOrders] = await Promise.all([
    getVendorHubReportsData(scopedEventId),
    getParticipationHistory(contact),
    getBoothOrders(scopedEventId),
  ])

  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading reports…</div>}>
      <VendorHubReportsClient
        initialData={data}
        initialEventId={eventId}
        historyRows={historyRows}
        contactIdFilter={contact}
        boothOrders={boothOrders}
      />
    </Suspense>
  )
}

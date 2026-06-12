import { notFound } from "next/navigation"

import { BazaarEventWorkspaceShell } from "@/components/vendor-hub/bazaar-event-workspace-shell"
import { BazaarEventOverviewClient } from "@/components/vendor-hub/events/bazaar-event-overview-client"
import { getVendorHubDashboardMetrics } from "@/lib/vendor-hub/vendor-hub-event-queries"
import { getVendorHubEventById } from "@/lib/vendor-hub/vendor-hub-event-queries"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"

export default async function BazaarEventOverviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  await requireVendorHubManage()

  const { eventId } = await params
  const event = await getVendorHubEventById(eventId)

  if (!event) {
    notFound()
  }

  const metrics = await getVendorHubDashboardMetrics(eventId)

  return (
    <BazaarEventWorkspaceShell event={event}>
      <BazaarEventOverviewClient event={event} metrics={metrics} />
    </BazaarEventWorkspaceShell>
  )
}

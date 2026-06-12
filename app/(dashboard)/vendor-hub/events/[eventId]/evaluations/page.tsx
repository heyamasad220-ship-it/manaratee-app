import { notFound } from "next/navigation"

import { BazaarEventWorkspaceShell } from "@/components/vendor-hub/bazaar-event-workspace-shell"
import { BazaarEventEvaluationsClient } from "@/components/vendor-hub/events/bazaar-event-evaluations-client"
import { getEventVendorEvaluations } from "@/lib/vendor-hub/vendor-evaluation-queries"
import { getVendorHubEventById } from "@/lib/vendor-hub/vendor-hub-event-queries"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"

export default async function BazaarEventEvaluationsPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  await requireVendorHubManage()

  const { eventId } = await params
  const event = await getVendorHubEventById(eventId)

  if (!event?.organization_id) {
    notFound()
  }

  const summary = await getEventVendorEvaluations(eventId, event.organization_id)

  return (
    <BazaarEventWorkspaceShell event={event}>
      <BazaarEventEvaluationsClient
        eventId={eventId}
        initialSummary={summary}
        eventDate={event.event_date}
      />
    </BazaarEventWorkspaceShell>
  )
}

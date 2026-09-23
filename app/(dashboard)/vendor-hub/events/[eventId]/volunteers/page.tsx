import { notFound, redirect } from "next/navigation"

import { EventVolunteersPanel } from "@/components/events/event-volunteers-panel"
import { BazaarEventWorkspaceShell } from "@/components/vendor-hub/bazaar-event-workspace-shell"
import { getInternalEventById } from "@/lib/events/internal-event-queries"
import { getParticipationsForSource } from "@/lib/service-participations/service-participation-queries"
import { getVendorHubEventById } from "@/lib/vendor-hub/vendor-hub-event-queries"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import {
  canManageVendorHub,
  requireVendorHubView,
} from "@/lib/vendor-hub/vendor-hub-permissions"

export default async function BazaarEventVolunteersPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  await requireVendorHubView()

  const { eventId } = await params
  const event = await getVendorHubEventById(eventId)
  if (!event) notFound()

  const internalEventId = event.internal_event_id
  if (!internalEventId) {
    redirect(VENDOR_HUB_ROUTES.events.settings(eventId))
  }

  const [internalEvent, participations, canManage] = await Promise.all([
    getInternalEventById(internalEventId),
    getParticipationsForSource({
      sourceType: "internal_event",
      sourceId: internalEventId,
    }),
    canManageVendorHub(),
  ])

  if (!internalEvent) notFound()

  return (
    <BazaarEventWorkspaceShell event={event}>
      <EventVolunteersPanel
        event={internalEvent}
        participations={participations}
        canManage={canManage}
      />
    </BazaarEventWorkspaceShell>
  )
}

import { notFound } from "next/navigation"

import { BazaarEventWorkspaceShell } from "@/components/vendor-hub/bazaar-event-workspace-shell"
import BazaarPaymentsPanel from "@/components/vendor-hub/events/bazaar-payments-panel"
import { getVendorHubEventById } from "@/lib/vendor-hub/vendor-hub-event-queries"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"

export default async function BazaarEventPaymentsPage({
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

  return (
    <BazaarEventWorkspaceShell event={event}>
      <BazaarPaymentsPanel eventId={eventId} />
    </BazaarEventWorkspaceShell>
  )
}

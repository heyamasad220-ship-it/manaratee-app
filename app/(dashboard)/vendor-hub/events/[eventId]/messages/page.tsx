import { notFound } from "next/navigation"

import { BazaarEventWorkspaceShell } from "@/components/vendor-hub/bazaar-event-workspace-shell"
import { BazaarEventMessagesClient } from "@/components/vendor-hub/events/bazaar-event-messages-client"
import { getEventVendorAnnouncements } from "@/lib/vendor-hub/vendor-announcement-actions"
import { getVendorHubEventById } from "@/lib/vendor-hub/vendor-hub-event-queries"
import { createClient } from "@/lib/supabase/server"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"

export default async function BazaarEventMessagesPage({
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

  const supabase = await createClient()
  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", event.organization_id)
    .maybeSingle()

  const announcements = await getEventVendorAnnouncements(eventId, event.organization_id)

  return (
    <BazaarEventWorkspaceShell event={event}>
      <BazaarEventMessagesClient
        eventId={eventId}
        eventName={event.name}
        organizationId={event.organization_id}
        organizationName={(organization?.name as string) ?? "Your organization"}
        initialAnnouncements={announcements}
      />
    </BazaarEventWorkspaceShell>
  )
}

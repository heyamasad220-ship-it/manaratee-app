import { notFound } from "next/navigation"

import { BazaarEventWorkspaceShell } from "@/components/vendor-hub/bazaar-event-workspace-shell"
import {
  BazaarEventSettingsClient,
  type BazaarSettingsSection,
} from "@/components/vendor-hub/events/bazaar-event-settings-client"
import { getBazaarEventDeleteBlockers } from "@/lib/vendor-hub/vendor-hub-event-actions"
import { getVendorHubEventById } from "@/lib/vendor-hub/vendor-hub-event-queries"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"

export default async function BazaarEventSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>
  searchParams: Promise<{ section?: string }>
}) {
  await requireVendorHubManage()

  const { eventId } = await params
  const { section: sectionParam } = await searchParams
  const section: BazaarSettingsSection = sectionParam === "booths" ? "booths" : "general"
  const event = await getVendorHubEventById(eventId)

  if (!event) {
    notFound()
  }

  const deleteBlockedReason =
    section === "general" ? await getBazaarEventDeleteBlockers(eventId) : null

  return (
    <BazaarEventWorkspaceShell event={event}>
      <BazaarEventSettingsClient
        event={event}
        deleteBlockedReason={deleteBlockedReason}
        section={section}
      />
    </BazaarEventWorkspaceShell>
  )
}

import type { EventTicketingConfig } from "@/lib/tickets/ticket-types"
import { linkedCampaignIdFromConfig } from "@/lib/events/event-finance-types"

/** Prefer the real campaign_id column; fall back to legacy JSON on ticketing_config. */
export function linkedCampaignIdFromEvent(event: {
  campaign_id?: string | null
  ticketing_config?: EventTicketingConfig | null
}): string | null {
  const fromColumn =
    typeof event.campaign_id === "string" && event.campaign_id.trim()
      ? event.campaign_id.trim()
      : null
  return fromColumn || linkedCampaignIdFromConfig(event.ticketing_config)
}

export function withLinkedCampaignConfig(
  config: Record<string, unknown> | EventTicketingConfig | null | undefined,
  campaignId: string | null
): Record<string, unknown> {
  return {
    ...(config || {}),
    linkedCampaignId: campaignId,
  }
}

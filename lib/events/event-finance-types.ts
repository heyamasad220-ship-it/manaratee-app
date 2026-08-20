import type { EventTicketingConfig } from "@/lib/tickets/ticket-types"

export type EventCampaignOption = {
  id: string
  name: string
}

export type LinkedCampaignSummary = {
  campaignId: string
  campaignName: string
  raisedCents: number
  pledgeCents: number
  pledgeBalanceCents: number
  donorCount: number
  currency: string
}

export function linkedCampaignIdFromConfig(
  config: EventTicketingConfig | null | undefined
): string | null {
  const id = config?.linkedCampaignId
  return typeof id === "string" && id.trim() ? id.trim() : null
}

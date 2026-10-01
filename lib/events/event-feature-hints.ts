import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

export type EventFeatureHints = {
  hasPlanningQuote: boolean
  hasSponsors: boolean
}

/** Used only when a feature switch was never saved. */
export async function getEventFeatureHints(input: {
  eventId: string
  campaignId?: string | null
}): Promise<EventFeatureHints> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { hasPlanningQuote: false, hasSponsors: Boolean(input.campaignId) }
  }

  const supabase = await createClient()
  const [quotes, packages] = await Promise.all([
    supabase
      .from("event_planning_quotes")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("internal_event_id", input.eventId),
    supabase
      .from("sponsorship_packages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("event_id", input.eventId),
  ])

  return {
    hasPlanningQuote: !quotes.error && (quotes.count ?? 0) > 0,
    hasSponsors:
      Boolean(input.campaignId) || (!packages.error && (packages.count ?? 0) > 0),
  }
}

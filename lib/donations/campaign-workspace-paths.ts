export type CampaignWorkspaceTab =
  | "overview"
  | "strategy"
  | "prospects"
  | "pledges"
  | "donations"
  | "groups"
  | "wishlist"

export const CAMPAIGN_WORKSPACE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "strategy", label: "Strategy" },
  { id: "prospects", label: "Prospects" },
  { id: "pledges", label: "Pledges" },
  { id: "donations", label: "Donations" },
  { id: "groups", label: "Groups" },
  { id: "wishlist", label: "Wishlist" },
] as const satisfies readonly { id: CampaignWorkspaceTab; label: string }[]

export function parseCampaignWorkspaceTab(
  tab: string | null | undefined
): CampaignWorkspaceTab {
  if (
    tab === "overview" ||
    tab === "strategy" ||
    tab === "prospects" ||
    tab === "pledges" ||
    tab === "donations" ||
    tab === "groups" ||
    tab === "wishlist"
  ) {
    return tab
  }
  return "overview"
}

export function donationCampaignWorkspaceHref(
  campaignId: string,
  options?: {
    tab?: CampaignWorkspaceTab
    groupId?: string
    followUp?: "overdue" | "upcoming"
    assignee?: "unassigned" | string
    stage?: string
    pledged?: "pledged" | "not_pledged"
  }
): string {
  const base = `/donations/campaigns/${campaignId}`
  const params = new URLSearchParams()
  if (options?.tab && options.tab !== "overview") {
    params.set("tab", options.tab)
  }
  if (options?.groupId) {
    params.set("group", options.groupId)
  }
  if (options?.followUp) {
    params.set("followUp", options.followUp)
  }
  if (options?.assignee) {
    params.set("assignee", options.assignee)
  }
  if (options?.stage) {
    params.set("stage", options.stage)
  }
  if (options?.pledged) {
    params.set("pledged", options.pledged)
  }
  const query = params.toString()
  return query ? `${base}?${query}` : base
}

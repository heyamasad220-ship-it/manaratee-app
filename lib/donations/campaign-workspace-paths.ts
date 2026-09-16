export type CampaignWorkspaceTab =
  | "overview"
  | "events"
  | "plan"
  | "strategy"
  | "prospects"
  | "pledges"
  | "donations"
  | "sponsors"
  | "groups"
  | "wishlist"

export type FundraisingPlanSection = "strategy" | "prospects"

export const CAMPAIGN_WORKSPACE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "events", label: "Event" },
  { id: "plan", label: "Fundraising Plan" },
  { id: "pledges", label: "Pledges" },
  { id: "donations", label: "Donations" },
  { id: "sponsors", label: "Sponsorship" },
  { id: "groups", label: "Groups" },
  { id: "wishlist", label: "Wishlist" },
] as const satisfies readonly { id: CampaignWorkspaceTab; label: string }[]

export function parseCampaignWorkspaceTab(
  tab: string | null | undefined
): CampaignWorkspaceTab {
  if (
    tab === "overview" ||
    tab === "events" ||
    tab === "plan" ||
    tab === "strategy" ||
    tab === "prospects" ||
    tab === "pledges" ||
    tab === "donations" ||
    tab === "sponsors" ||
    tab === "groups" ||
    tab === "wishlist"
  ) {
    return tab
  }
  return "overview"
}

export function isFundraisingPlanTab(tab: CampaignWorkspaceTab): boolean {
  return tab === "plan" || tab === "strategy" || tab === "prospects"
}

export function parseFundraisingPlanSection(
  tab: CampaignWorkspaceTab,
  section: string | null | undefined
): FundraisingPlanSection {
  if (tab === "prospects" || section === "prospects") return "prospects"
  return "strategy"
}

export type CampaignWorkspaceHrefOptions = {
  tab?: CampaignWorkspaceTab
  groupId?: string
  followUp?: "overdue" | "upcoming"
  assignee?: "unassigned" | string
  stage?: string
  pledged?: "pledged" | "not_pledged"
  section?: "packages" | "prospects"
  askType?: "donation" | "sponsorship"
  askLevelId?: string
  asked?: boolean
}

function prospectFollowUpParam(
  value: string | null | undefined
): "overdue" | "upcoming" | undefined {
  return value === "overdue" || value === "upcoming" ? value : undefined
}

function prospectPledgedParam(
  value: string | null | undefined
): "pledged" | "not_pledged" | undefined {
  return value === "pledged" || value === "not_pledged" ? value : undefined
}

function prospectAskTypeParam(
  value: string | null | undefined
): "donation" | "sponsorship" | undefined {
  return value === "donation" || value === "sponsorship" ? value : undefined
}

export function donationCampaignWorkspaceHref(
  campaignId: string,
  options?: CampaignWorkspaceHrefOptions
): string {
  const base = `/donations/campaigns/${campaignId}`
  const params = new URLSearchParams()

  let tab = options?.tab
  let section = options?.section

  if (tab === "strategy") {
    tab = "plan"
    if (section !== "prospects") section = undefined
  } else if (tab === "prospects") {
    tab = "plan"
    section = "prospects"
  }

  if (tab && tab !== "overview") {
    params.set("tab", tab)
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
  if (tab === "sponsors" && section === "packages") {
    params.set("section", "packages")
  } else if (tab === "plan" && section === "prospects") {
    params.set("section", "prospects")
  }
  if (options?.askType) {
    params.set("askType", options.askType)
  }
  if (options?.askLevelId) {
    params.set("askLevel", options.askLevelId)
  }
  if (options?.asked) {
    params.set("asked", "1")
  }
  const query = params.toString()
  return query ? `${base}?${query}` : base
}

export function canonicalizeCampaignWorkspaceHref(
  campaignId: string,
  searchParams: { get(name: string): string | null }
): string | null {
  const tab = searchParams.get("tab")
  if (tab !== "strategy" && tab !== "prospects") return null

  return donationCampaignWorkspaceHref(campaignId, {
    tab: "plan",
    section: tab === "prospects" ? "prospects" : undefined,
    groupId: searchParams.get("group") || undefined,
    followUp: prospectFollowUpParam(searchParams.get("followUp")),
    assignee: searchParams.get("assignee") || undefined,
    stage: searchParams.get("stage") || undefined,
    pledged: prospectPledgedParam(searchParams.get("pledged")),
    askType: prospectAskTypeParam(searchParams.get("askType")),
    askLevelId: searchParams.get("askLevel") || undefined,
    asked: searchParams.get("asked") === "1",
  })
}

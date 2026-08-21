export function isDonationCampaignsOverviewPath(pathname: string) {
  return pathname === "/donations/campaigns"
}

export function isDonationCampaignsDetailPath(pathname: string) {
  return pathname.startsWith("/donations/campaigns/")
}

export function isDonationCampaignsSectionPath(pathname: string) {
  return (
    isDonationCampaignsOverviewPath(pathname) ||
    isDonationCampaignsDetailPath(pathname)
  )
}

export {
  donationCampaignWorkspaceHref,
  parseCampaignWorkspaceTab,
  type CampaignWorkspaceTab,
} from "@/lib/donations/campaign-workspace-paths"


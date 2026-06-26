export function isDonationCampaignsOverviewPath(pathname: string) {
  return pathname === "/donations/campaigns"
}

export function isDonationCampaignsDetailPath(pathname: string) {
  return pathname.startsWith("/donations/campaigns/")
}

export function isDonationCampaignsSectionPath(pathname: string) {
  return (
    isDonationCampaignsOverviewPath(pathname) ||
    isDonationCampaignsDetailPath(pathname) ||
    pathname === "/donations/pledges" ||
    pathname.startsWith("/donations/pledges/")
  )
}

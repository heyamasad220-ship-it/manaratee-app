"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

import { Header } from "@/components/layout/header"
import {
  CampaignBreadcrumbProvider,
  useCampaignBreadcrumb,
} from "@/components/donations/campaign-breadcrumb-context"
import { isDonationCampaignsDetailPath } from "@/lib/donations/donation-campaign-paths"

function DonationCampaignsShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { campaignName } = useCampaignBreadcrumb()
  const isPledges =
    pathname === "/donations/campaigns/pledges" ||
    pathname.startsWith("/donations/campaigns/pledges/")
  const showCampaignName = isDonationCampaignsDetailPath(pathname) && !isPledges && campaignName

  return (
    <>
      <Header
        title={isPledges ? "Pledges" : "Campaigns"}
        breadcrumbExtras={showCampaignName ? [{ label: campaignName }] : undefined}
      />
      {children}
    </>
  )
}

export function DonationCampaignsShell({
  children,
}: {
  children: ReactNode
  canManage?: boolean
}) {
  return (
    <CampaignBreadcrumbProvider>
      <DonationCampaignsShellFrame>{children}</DonationCampaignsShellFrame>
    </CampaignBreadcrumbProvider>
  )
}

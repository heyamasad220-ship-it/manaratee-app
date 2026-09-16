"use client"

import Link from "next/link"

import {
  CAMPAIGN_WORKSPACE_TABS,
  donationCampaignWorkspaceHref,
  isFundraisingPlanTab,
  type CampaignWorkspaceTab,
} from "@/lib/donations/campaign-workspace-paths"
import { cn } from "@/lib/utils"

type CampaignWorkspaceNavProps = {
  campaignId: string
  activeTab: CampaignWorkspaceTab
}

export function CampaignWorkspaceNav({ campaignId, activeTab }: CampaignWorkspaceNavProps) {
  return (
    <nav
      aria-label="Campaign workspace"
      className="flex min-w-0 flex-wrap gap-1 border-b border-border pb-px"
    >
      {CAMPAIGN_WORKSPACE_TABS.map((tab) => {
        const isActive =
          tab.id === "plan" ? isFundraisingPlanTab(activeTab) : tab.id === activeTab
        return (
          <Link
            key={tab.id}
            href={donationCampaignWorkspaceHref(campaignId, { tab: tab.id })}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

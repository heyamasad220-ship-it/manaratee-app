"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { CampaignGroupsReportPanel } from "@/components/donations/campaign-groups-report-panel"
import { CampaignWishlistReportPanel } from "@/components/donations/campaign-wishlist-report-panel"
import { DonationCampaignsOverviewTable } from "@/components/donations/donation-campaigns-overview-table"
import { cn } from "@/lib/utils"

const CAMPAIGN_HOME_VIEWS = [
  { id: "campaigns", label: "Campaigns", href: "/donations/campaigns" },
  { id: "groups", label: "Campaign Groups", href: "/donations/campaigns?view=groups" },
  { id: "wishlist", label: "Wishlist", href: "/donations/campaigns?view=wishlist" },
] as const

type CampaignHomeView = (typeof CAMPAIGN_HOME_VIEWS)[number]["id"]

function resolveCampaignHomeView(value: string | null): CampaignHomeView {
  if (value === "groups" || value === "wishlist") return value
  return "campaigns"
}

export function DonationCampaignsHome({ canManage }: { canManage: boolean }) {
  const searchParams = useSearchParams()
  const view = resolveCampaignHomeView(searchParams.get("view"))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 w-fit rounded-lg border bg-muted/40 p-1">
        {CAMPAIGN_HOME_VIEWS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              view === item.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {view === "groups" ? (
        <CampaignGroupsReportPanel embedded />
      ) : view === "wishlist" ? (
        <CampaignWishlistReportPanel embedded />
      ) : (
        <DonationCampaignsOverviewTable canManage={canManage} />
      )}
    </div>
  )
}

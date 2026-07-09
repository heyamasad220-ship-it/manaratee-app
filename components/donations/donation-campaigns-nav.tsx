"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { isDonationCampaignsOverviewPath } from "@/lib/donations/donation-campaign-paths"

export type DonationCampaignsTab = {
  label: string
  href: string
  matchPrefix: string
  overviewOnly?: boolean
  requiresManage?: boolean
  extraMatchPrefixes?: string[]
}

export const DONATION_CAMPAIGNS_TABS: DonationCampaignsTab[] = [
  {
    label: "Overview",
    href: "/donations/campaigns",
    matchPrefix: "/donations/campaigns",
    overviewOnly: true,
  },
  {
    label: "Pledges",
    href: "/donations/campaigns/pledges",
    matchPrefix: "/donations/campaigns/pledges",
    extraMatchPrefixes: ["/donations/reports/pledges", "/donations/pledges"],
  },
]

function tabPathMatches(tab: DonationCampaignsTab, pathname: string) {
  if (tab.overviewOnly) {
    return isDonationCampaignsOverviewPath(pathname)
  }

  if (pathname === tab.href || pathname.startsWith(`${tab.matchPrefix}/`)) {
    return true
  }

  return (tab.extraMatchPrefixes ?? []).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function isTabActive(tab: DonationCampaignsTab, pathname: string, tabs: DonationCampaignsTab[]) {
  const matches = tabPathMatches(tab, pathname)

  if (!matches) return false

  const overridden = tabs.some((other) => {
    if (other.href === tab.href) return false
    return tabPathMatches(other, pathname) && other.matchPrefix.length > tab.matchPrefix.length
  })

  return !overridden
}

export function DonationCampaignsNav({ canManage }: { canManage: boolean }) {
  const pathname = usePathname()
  const visibleTabs = DONATION_CAMPAIGNS_TABS.filter((tab) => !tab.requiresManage || canManage)

  return (
    <div className="border-b border-border bg-background px-6">
      <nav className="-mb-px flex gap-0 overflow-x-auto">
        {visibleTabs.map((tab) => {
          const active = isTabActive(tab, pathname, visibleTabs)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

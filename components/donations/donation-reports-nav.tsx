"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  DONATION_REPORTS_CAMPAIGNS_PATH,
  DONATION_REPORTS_DONORS_PATH,
  DONATION_REPORTS_GIVING_PATH,
  DONATION_REPORTS_HOME_PATH,
  DONATION_REPORTS_PLEDGES_ANALYTICS_PATH,
  DONATION_REPORTS_RECURRING_ANALYTICS_PATH,
} from "@/lib/donations/donation-payment-paths"

export type DonationReportsTab = {
  label: string
  href: string
  matchPrefix: string
  extraMatchPrefixes?: string[]
  exact?: boolean
}

export const DONATION_REPORTS_TABS: DonationReportsTab[] = [
  {
    label: "Giving Summary",
    href: DONATION_REPORTS_GIVING_PATH,
    matchPrefix: DONATION_REPORTS_GIVING_PATH,
  },
  {
    label: "Donor Giving",
    href: DONATION_REPORTS_DONORS_PATH,
    matchPrefix: DONATION_REPORTS_DONORS_PATH,
    extraMatchPrefixes: ["/donations/donors/individuals", "/donations/donors/organizations"],
  },
  {
    label: "Campaign Performance",
    href: DONATION_REPORTS_CAMPAIGNS_PATH,
    matchPrefix: DONATION_REPORTS_CAMPAIGNS_PATH,
    extraMatchPrefixes: ["/donations/reports/campaign-groups"],
  },
  {
    label: "Pledge Performance",
    href: DONATION_REPORTS_PLEDGES_ANALYTICS_PATH,
    matchPrefix: DONATION_REPORTS_PLEDGES_ANALYTICS_PATH,
  },
  {
    label: "Recurring Giving",
    href: DONATION_REPORTS_RECURRING_ANALYTICS_PATH,
    matchPrefix: DONATION_REPORTS_RECURRING_ANALYTICS_PATH,
  },
]

function tabPathMatches(tab: DonationReportsTab, pathname: string) {
  if (tab.exact) return pathname === tab.href

  if (pathname === tab.href || pathname.startsWith(`${tab.matchPrefix}/`)) {
    return true
  }

  return (tab.extraMatchPrefixes ?? []).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function isTabActive(tab: DonationReportsTab, pathname: string, tabs: DonationReportsTab[]) {
  const matches = tabPathMatches(tab, pathname)
  if (!matches) return false

  const overridden = tabs.some((other) => {
    if (other.href === tab.href) return false
    return tabPathMatches(other, pathname) && other.matchPrefix.length > tab.matchPrefix.length
  })

  return !overridden
}

export function DonationReportsNav({ className }: { canManage?: boolean; className?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const range = searchParams.get("range")

  if (pathname === DONATION_REPORTS_HOME_PATH) {
    return null
  }

  return (
    <div className={cn("border-b border-border", className)}>
      <nav className="-mb-px flex gap-0 overflow-x-auto">
        {DONATION_REPORTS_TABS.map((tab) => {
          const active = isTabActive(tab, pathname, DONATION_REPORTS_TABS)
          const view = searchParams.get("view")
          const href =
            range && tab.href === DONATION_REPORTS_GIVING_PATH
              ? `${tab.href}?range=${encodeURIComponent(range)}`
              : tab.href === DONATION_REPORTS_DONORS_PATH &&
                  (view === "group" || view === "household")
                ? `${tab.href}?view=${encodeURIComponent(view)}`
                : tab.href
          return (
            <Link
              key={tab.href}
              href={href}
              prefetch={false}
              className={cn(
                "relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {active && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

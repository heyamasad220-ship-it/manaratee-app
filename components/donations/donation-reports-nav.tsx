"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export type DonationReportsTab = {
  label: string
  href: string
  matchPrefix: string
  extraMatchPrefixes?: string[]
  exact?: boolean
  requiresManage?: boolean
}

export const DONATION_REPORTS_TABS: DonationReportsTab[] = [
  {
    label: "One-Time Donations",
    href: "/donations/reports/one-time",
    matchPrefix: "/donations/reports/one-time",
    extraMatchPrefixes: ["/donations/payments/one-time"],
  },
  {
    label: "Recurring Donations",
    href: "/donations/reports/recurring",
    matchPrefix: "/donations/reports/recurring",
    extraMatchPrefixes: ["/donations/payments/recurring"],
  },
  {
    label: "Donors",
    href: "/donations/reports/donors",
    matchPrefix: "/donations/reports/donors",
    extraMatchPrefixes: ["/donations/donors/individuals", "/donations/donors/organizations"],
  },
  {
    label: "Campaign Groups",
    href: "/donations/reports/campaign-groups",
    matchPrefix: "/donations/reports/campaign-groups",
  },
  {
    label: "Import",
    href: "/donations/reports/import",
    matchPrefix: "/donations/reports/import",
    extraMatchPrefixes: ["/donations/payments/import", "/donations/import"],
    requiresManage: true,
  },
  {
    label: "Match Payments",
    href: "/donations/reports/match",
    matchPrefix: "/donations/reports/match",
    extraMatchPrefixes: ["/donations/payments/match", "/donations/reconcile"],
    requiresManage: true,
  },
  {
    label: "Receipts",
    href: "/donations/reports/receipts",
    matchPrefix: "/donations/reports/receipts",
    extraMatchPrefixes: ["/donations/reports/tax-receipts"],
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
    const otherMatches = tabPathMatches(other, pathname)
    return otherMatches && other.matchPrefix.length > tab.matchPrefix.length
  })

  return !overridden
}

export function DonationReportsNav({
  canManage,
  className,
}: {
  canManage: boolean
  className?: string
}) {
  const pathname = usePathname()
  const visibleTabs = DONATION_REPORTS_TABS.filter((tab) => !tab.requiresManage || canManage)

  return (
    <div className={cn("border-b border-border", className)}>
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

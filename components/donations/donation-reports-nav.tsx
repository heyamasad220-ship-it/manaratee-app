"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export type DonationReportsTab = {
  label: string
  href: string
  matchPrefix: string
  exact?: boolean
}

export const DONATION_REPORTS_TABS: DonationReportsTab[] = [
  { label: "Donors", href: "/donations/donors", matchPrefix: "/donations/donors" },
  {
    label: "Receipts",
    href: "/donations/reports/receipts",
    matchPrefix: "/donations/reports/receipts",
  },
]

function isTabActive(tab: DonationReportsTab, pathname: string, tabs: DonationReportsTab[]) {
  const matches = tab.exact
    ? pathname === tab.href
    : pathname === tab.href || pathname.startsWith(`${tab.matchPrefix}/`)

  if (!matches) return false

  const overridden = tabs.some((other) => {
    if (other.href === tab.href) return false
    const otherMatches = other.exact
      ? pathname === other.href
      : pathname === other.href || pathname.startsWith(`${other.matchPrefix}/`)
    return otherMatches && other.matchPrefix.length > tab.matchPrefix.length
  })

  return !overridden
}

export function DonationReportsNav() {
  const pathname = usePathname()

  return (
    <div className="border-b border-border bg-background px-6">
      <nav className="-mb-px flex gap-0 overflow-x-auto">
        {DONATION_REPORTS_TABS.map((tab) => {
          const active = isTabActive(tab, pathname, DONATION_REPORTS_TABS)
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

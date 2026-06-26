"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export type DonationPaymentsTab = {
  label: string
  href: string
  matchPrefix: string
  requiresManage?: boolean
}

export const DONATION_PAYMENTS_TABS: DonationPaymentsTab[] = [
  {
    label: "One-Time Donations",
    href: "/donations/payments/one-time",
    matchPrefix: "/donations/payments/one-time",
  },
  {
    label: "Recurring Donations",
    href: "/donations/payments/recurring",
    matchPrefix: "/donations/payments/recurring",
  },
  {
    label: "Import",
    href: "/donations/payments/import",
    matchPrefix: "/donations/payments/import",
    requiresManage: true,
  },
  {
    label: "Match Payments",
    href: "/donations/payments/match",
    matchPrefix: "/donations/payments/match",
    requiresManage: true,
  },
]

function isTabActive(tab: DonationPaymentsTab, pathname: string, tabs: DonationPaymentsTab[]) {
  const matches =
    pathname === tab.href || pathname.startsWith(`${tab.matchPrefix}/`)

  if (!matches) return false

  const overridden = tabs.some((other) => {
    if (other.href === tab.href) return false
    const otherMatches =
      pathname === other.href || pathname.startsWith(`${other.matchPrefix}/`)
    return otherMatches && other.matchPrefix.length > tab.matchPrefix.length
  })

  return !overridden
}

export function DonationPaymentsNav({ canManage }: { canManage: boolean }) {
  const pathname = usePathname()
  const visibleTabs = DONATION_PAYMENTS_TABS.filter((tab) => !tab.requiresManage || canManage)

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

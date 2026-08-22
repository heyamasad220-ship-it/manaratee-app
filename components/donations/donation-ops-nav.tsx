"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  DONATION_IMPORT_MATCH_PATH,
  DONATION_RECEIPTS_OPS_PATH,
  DONATION_RECURRING_OPS_PATH,
  DONATION_TRANSACTIONS_PATH,
} from "@/lib/donations/donation-payment-paths"

export type DonationOpsTab = {
  label: string
  href: string
  matchPrefix: string
  extraMatchPrefixes?: string[]
  requiresManage?: boolean
}

export const DONATION_OPS_TABS: DonationOpsTab[] = [
  {
    label: "Transactions",
    href: DONATION_TRANSACTIONS_PATH,
    matchPrefix: DONATION_TRANSACTIONS_PATH,
    extraMatchPrefixes: ["/donations/payments/one-time", "/donations/reports/one-time"],
  },
  {
    label: "Recurring",
    href: DONATION_RECURRING_OPS_PATH,
    matchPrefix: DONATION_RECURRING_OPS_PATH,
    extraMatchPrefixes: ["/donations/reports/recurring", "/donations/recurring"],
  },
  {
    label: "Import & Match",
    href: DONATION_IMPORT_MATCH_PATH,
    matchPrefix: DONATION_IMPORT_MATCH_PATH,
    extraMatchPrefixes: [
      "/donations/payments/import",
      "/donations/payments/match",
      "/donations/reports/import",
      "/donations/reports/match",
      "/donations/import",
      "/donations/reconcile",
    ],
    requiresManage: true,
  },
  {
    label: "Receipts & Statements",
    href: DONATION_RECEIPTS_OPS_PATH,
    matchPrefix: DONATION_RECEIPTS_OPS_PATH,
    extraMatchPrefixes: ["/donations/reports/receipts", "/donations/reports/tax-receipts"],
  },
]

function tabPathMatches(tab: DonationOpsTab, pathname: string) {
  if (pathname === tab.href || pathname.startsWith(`${tab.matchPrefix}/`)) {
    return true
  }

  return (tab.extraMatchPrefixes ?? []).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function isTabActive(tab: DonationOpsTab, pathname: string, tabs: DonationOpsTab[]) {
  const matches = tabPathMatches(tab, pathname)
  if (!matches) return false

  const overridden = tabs.some((other) => {
    if (other.href === tab.href) return false
    return tabPathMatches(other, pathname) && other.matchPrefix.length > tab.matchPrefix.length
  })

  return !overridden
}

export function DonationOpsNav({
  canManage,
  className,
}: {
  canManage: boolean
  className?: string
}) {
  const pathname = usePathname()
  const visibleTabs = DONATION_OPS_TABS.filter((tab) => !tab.requiresManage || canManage)

  return (
    <div className={cn("border-b border-border bg-background px-6", className)}>
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
              {active && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

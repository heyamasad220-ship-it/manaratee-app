"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export type ContactsReportsTab = {
  label: string
  href: string
  matchPrefix: string
}

export const CONTACTS_REPORTS_TABS: ContactsReportsTab[] = [
  {
    label: "Directory",
    href: "/contacts/reports/directory",
    matchPrefix: "/contacts/reports/directory",
  },
]

function isTabActive(tab: ContactsReportsTab, pathname: string) {
  return pathname === tab.href || pathname.startsWith(`${tab.matchPrefix}/`)
}

export function ContactsReportsNav() {
  const pathname = usePathname()

  return (
    <div className="border-b border-border bg-background px-6">
      <nav className="-mb-px flex gap-0 overflow-x-auto">
        {CONTACTS_REPORTS_TABS.map((tab) => {
          const active = isTabActive(tab, pathname)
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

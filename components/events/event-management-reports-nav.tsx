"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { EVENT_MANAGEMENT_REPORTS_TABS } from "@/lib/events/event-management-reports-path"
import { cn } from "@/lib/utils"

export function EventManagementReportsNav() {
  const pathname = usePathname()

  return (
    <nav className="-mb-px flex gap-0 overflow-x-auto">
      {EVENT_MANAGEMENT_REPORTS_TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`)
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              "relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {active ? (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

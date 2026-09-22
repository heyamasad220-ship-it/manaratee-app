"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  EVENT_MANAGEMENT_TICKETING_CHECK_IN_PATH,
  EVENT_MANAGEMENT_TICKETING_EVENTS_PATH,
  EVENT_MANAGEMENT_TICKETING_ORDERS_PATH,
  EVENT_MANAGEMENT_TICKETING_PATH,
  EVENT_MANAGEMENT_TICKETING_SETTINGS_PATH,
} from "@/lib/events/event-management-section-path"
import { cn } from "@/lib/utils"

const tabs = [
  { label: "Overview", href: EVENT_MANAGEMENT_TICKETING_PATH },
  { label: "Events", href: EVENT_MANAGEMENT_TICKETING_EVENTS_PATH },
  { label: "Orders", href: EVENT_MANAGEMENT_TICKETING_ORDERS_PATH },
  { label: "Check-in", href: EVENT_MANAGEMENT_TICKETING_CHECK_IN_PATH },
  { label: "Settings", href: EVENT_MANAGEMENT_TICKETING_SETTINGS_PATH },
] as const

function isTabActive(pathname: string, href: string) {
  if (href === EVENT_MANAGEMENT_TICKETING_PATH) {
    return pathname === href
  }

  return pathname.startsWith(href)
}

export function TicketingTabNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-0 border-b border-border">
      {tabs.map((tab) => {
        const isActive = isTabActive(pathname, tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative px-4 py-3 text-sm font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {isActive ? (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

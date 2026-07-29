"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const tabs = [
  { label: "Overview", href: "/event-management/ticketing" },
  { label: "Orders", href: "/event-management/ticketing/orders" },
  { label: "Reports", href: "/event-management/ticketing/reports" },
  { label: "Settings", href: "/event-management/ticketing/settings" },
] as const

function isTabActive(pathname: string, href: string) {
  if (href === "/event-management/ticketing") {
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

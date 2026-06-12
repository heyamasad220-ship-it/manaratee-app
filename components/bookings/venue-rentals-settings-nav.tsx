"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const settingsTabs = [
  {
    label: "Overview",
    href: "/bookings/settings",
    matchPrefix: "/bookings/settings",
    exact: true,
  },
  {
    label: "Event Types",
    href: "/bookings/settings/event-types",
    matchPrefix: "/bookings/settings/event-types",
  },
  {
    label: "Notifications",
    href: "/bookings/settings/notifications",
    matchPrefix: "/bookings/settings/notifications",
  },
] as const

export function VenueRentalsSettingsNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 border-b border-border">
      {settingsTabs.map((tab) => {
        const isActive =
          "exact" in tab && tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.matchPrefix)

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const settingsTabs = [
  {
    label: "General",
    href: "/bookings/settings/general",
    matchPrefix: "/bookings/settings/general",
  },
  {
    label: "Notifications",
    href: "/bookings/settings/notifications",
    matchPrefix: "/bookings/settings/notifications",
  },
  {
    label: "Event Types",
    href: "/bookings/settings/event-types",
    matchPrefix: "/bookings/settings/event-types",
  },
  {
    label: "Add-ons",
    href: "/bookings/settings/addons",
    matchPrefix: "/bookings/settings/addons",
  },
  {
    label: "Discounts",
    href: "/bookings/settings/discounts",
    matchPrefix: "/bookings/settings/discounts",
  },
] as const

export function VenueRentalsSettingsNav() {
  const pathname = usePathname() ?? ""

  return (
    <nav className="flex gap-1 border-b border-border">
      {settingsTabs.map((tab) => {
        const isActive = pathname.startsWith(tab.matchPrefix)

        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch={false}
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

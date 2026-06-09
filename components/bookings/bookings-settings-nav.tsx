"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const settingsTabs = [
  {
    label: "Overview",
    href: "/facilities/settings",
    matchPrefix: "/facilities/settings",
    exact: true,
  },
  {
    label: "Spaces",
    href: "/facilities/settings/spaces",
    matchPrefix: "/facilities/settings/spaces",
  },
] as const

export function FacilitiesSettingsNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 border-b border-border">
      {settingsTabs.map((tab) => {
        const isActive = tab.exact
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

/** @deprecated Use FacilitiesSettingsNav */
export { FacilitiesSettingsNav as BookingsSettingsNav }

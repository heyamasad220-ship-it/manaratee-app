"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const settingsTabs = [
  {
    label: "Positions",
    href: "/workforce/settings/positions",
    matchPrefix: "/workforce/settings/positions",
  },
  {
    label: "Application Templates",
    href: "/workforce/settings/application-templates",
    matchPrefix: "/workforce/settings/application-templates",
  },
] as const

export function PeopleManagementSettingsNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-1 border-b border-border">
      {settingsTabs.map((tab) => {
        const isActive =
          pathname === tab.href || pathname.startsWith(`${tab.matchPrefix}/`)

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

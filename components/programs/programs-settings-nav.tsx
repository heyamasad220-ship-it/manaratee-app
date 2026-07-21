"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const settingsTabs = [
  {
    label: "General",
    href: "/programs/settings",
    isActive: (pathname: string) =>
      pathname === "/programs/settings" || pathname.startsWith("/programs/settings?"),
  },
  {
    label: "Service Needs",
    href: "/programs/settings/service-needs",
    isActive: (pathname: string) => pathname.startsWith("/programs/settings/service-needs"),
  },
] as const

export function ProgramsSettingsNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 border-b border-border">
      {settingsTabs.map((tab) => {
        const isActive = tab.isActive(pathname)

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

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

export type ProgramsSectionTabId = "catalog" | "schedule" | "calendar"

export type ProgramsSectionTab = {
  id: ProgramsSectionTabId
  label: string
  href: string
}

export const PROGRAMS_SECTION_TABS: ProgramsSectionTab[] = [
  {
    id: "catalog",
    label: "Catalog",
    href: "/programs/catalog",
  },
  {
    id: "schedule",
    label: "Schedule",
    href: "/programs/schedule",
  },
  {
    id: "calendar",
    label: "Calendar",
    href: "/programs/calendar",
  },
]

export function resolveProgramsSectionTab(
  pathname: string
): ProgramsSectionTabId {
  if (
    pathname === "/programs/schedule" ||
    pathname.startsWith("/programs/schedule/")
  ) {
    return "schedule"
  }
  if (
    pathname === "/programs/calendar" ||
    pathname.startsWith("/programs/calendar/")
  ) {
    return "calendar"
  }
  return "catalog"
}

export function ProgramsSectionNav() {
  const pathname = usePathname()
  const activeId = resolveProgramsSectionTab(pathname)

  return (
    <div className="border-b border-border bg-background">
      <nav className="-mb-px flex gap-0 overflow-x-auto">
        {PROGRAMS_SECTION_TABS.map((tab) => {
          const active = tab.id === activeId
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
    </div>
  )
}

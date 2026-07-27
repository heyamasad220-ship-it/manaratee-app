"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"

export type ProgramsReportsTabId =
  | "overview"
  | "enrollment"
  | "attendance"
  | "waitlist"

export type ProgramsReportsTab = {
  id: ProgramsReportsTabId
  label: string
  href: string
}

export const PROGRAMS_REPORTS_TABS: ProgramsReportsTab[] = [
  { id: "overview", label: "Overview", href: "/programs/reports" },
  {
    id: "enrollment",
    label: "Registrations",
    href: "/programs/registrations",
  },
  {
    id: "attendance",
    label: "Attendance",
    href: "/programs/reports?tab=attendance",
  },
  {
    id: "waitlist",
    label: "Waitlist",
    href: "/programs/reports?tab=waitlist",
  },
]

export function resolveProgramsReportsTab(
  pathname: string,
  searchParams: Pick<URLSearchParams, "get">
): ProgramsReportsTabId {
  if (
    pathname === "/programs/registrations" ||
    pathname.startsWith("/programs/registrations/")
  ) {
    return "enrollment"
  }

  const tab = searchParams.get("tab")
  if (tab === "attendance" || tab === "waitlist" || tab === "enrollment") {
    return tab
  }

  return "overview"
}

export function ProgramsReportsNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeId = resolveProgramsReportsTab(pathname, searchParams)

  return (
    <div className="border-b border-border bg-background">
      <nav className="-mb-px flex gap-0 overflow-x-auto">
        {PROGRAMS_REPORTS_TABS.map((tab) => {
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

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const tabs = [
  { label: "Operations", href: "/event-management/reports" },
  {
    label: "Childcare Registrations",
    href: "/event-management/reports/childcare",
  },
] as const

function isTabActive(pathname: string, href: string) {
  if (href === "/event-management/reports") {
    return pathname === href
  }
  return pathname.startsWith(href)
}

export function EventManagementReportsTabNav() {
  const pathname = usePathname()

  return (
    <nav className="mt-4 flex gap-0 border-b border-border">
      {tabs.map((tab) => {
        const isActive = isTabActive(pathname, tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative px-4 py-3 text-sm font-medium transition-colors",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
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

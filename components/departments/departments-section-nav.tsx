"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import {
  DEPARTMENTS_SECTION_TABS,
  resolveDepartmentsSectionTab,
} from "@/lib/departments/departments-section-path"

export function DepartmentsSectionNav() {
  const pathname = usePathname()
  const activeId = resolveDepartmentsSectionTab(pathname)

  return (
    <div className="border-b border-border bg-background">
      <nav className="-mb-px flex gap-0 overflow-x-auto">
        {DEPARTMENTS_SECTION_TABS.map((tab) => {
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

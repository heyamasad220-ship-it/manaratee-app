"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  PROGRAMS_MODULE_TABS,
  resolveProgramsModuleTab,
} from "@/lib/programs/programs-module-nav"
import { cn } from "@/lib/utils"

export function ProgramsModuleNav() {
  const pathname = usePathname()
  const activeId = resolveProgramsModuleTab(pathname)

  return (
    <div className="border-b border-border bg-background">
      <nav className="-mb-px flex gap-0 overflow-x-auto">
        {PROGRAMS_MODULE_TABS.map((tab) => {
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

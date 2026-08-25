"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  PROGRAMS_FINANCE_PATH,
  PROGRAMS_FINANCE_PAYROLL_PATH,
} from "@/lib/programs/programs-module-nav"
import { cn } from "@/lib/utils"

const FINANCE_TABS = [
  { id: "transactions" as const, label: "Transactions", href: PROGRAMS_FINANCE_PATH },
  { id: "payroll" as const, label: "Payroll", href: PROGRAMS_FINANCE_PAYROLL_PATH },
]

export function ProgramsFinanceNav() {
  const pathname = usePathname()
  const activeId = pathname.startsWith(PROGRAMS_FINANCE_PAYROLL_PATH)
    ? "payroll"
    : "transactions"

  return (
    <div className="border-b border-border bg-background">
      <nav className="-mb-px flex gap-0 overflow-x-auto">
        {FINANCE_TABS.map((tab) => {
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

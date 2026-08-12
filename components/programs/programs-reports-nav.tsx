"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"

export type ProgramsReportsTabId =
  | "enrollment"
  | "enrollments"
  | "attendance"
  | "waitlist"
  | "childcare"
  | "transactions"
  | "tuition-plans"
  | "addons"
  | "payroll"

export type ProgramsReportsTab = {
  id: ProgramsReportsTabId
  label: string
  href: string
}

export const PROGRAMS_REPORTS_TABS: ProgramsReportsTab[] = [
  {
    id: "enrollment",
    label: "Registration",
    href: "/programs/registrations",
  },
  {
    id: "enrollments",
    label: "Enrollments",
    href: "/programs/reports/enrollments",
  },
  {
    id: "transactions",
    label: "Transactions",
    href: "/finance/transactions",
  },
  {
    id: "addons",
    label: "Add-ons",
    href: "/programs/reports/addons",
  },
  {
    id: "tuition-plans",
    label: "Payment Summary",
    href: "/programs/reports/tuition-plans",
  },
  {
    id: "waitlist",
    label: "Waitlist",
    href: "/programs/reports?tab=waitlist",
  },
  {
    id: "attendance",
    label: "Attendance",
    href: "/programs/reports?tab=attendance",
  },
  {
    id: "childcare",
    label: "Child Care",
    href: "/programs/reports/childcare",
  },
  {
    id: "payroll",
    label: "Payroll",
    href: "/finance/payroll",
  },
]

export function resolveProgramsReportsTab(
  pathname: string,
  searchParams: Pick<URLSearchParams, "get">
): ProgramsReportsTabId {
  if (
    pathname === "/finance/transactions" ||
    pathname.startsWith("/finance/transactions/")
  ) {
    return "transactions"
  }
  if (
    pathname === "/finance/payroll" ||
    pathname.startsWith("/finance/payroll/")
  ) {
    return "payroll"
  }
  if (
    pathname === "/programs/reports/tuition-plans" ||
    pathname.startsWith("/programs/reports/tuition-plans/")
  ) {
    return "tuition-plans"
  }
  if (
    pathname === "/programs/reports/addons" ||
    pathname.startsWith("/programs/reports/addons/")
  ) {
    return "addons"
  }
  if (
    pathname === "/programs/reports/enrollments" ||
    pathname.startsWith("/programs/reports/enrollments/")
  ) {
    return "enrollments"
  }
  if (
    pathname === "/programs/reports/childcare" ||
    pathname.startsWith("/programs/reports/childcare/")
  ) {
    return "childcare"
  }
  if (
    pathname === "/programs/registrations" ||
    pathname.startsWith("/programs/registrations/")
  ) {
    return "enrollment"
  }

  const tab = searchParams.get("tab")
  if (tab === "attendance" || tab === "waitlist") {
    return tab
  }
  if (tab === "enrollments") {
    return "enrollments"
  }
  if (tab === "addons" || tab === "add-ons") {
    return "addons"
  }

  // Overview merged into Registrations — treat bare /programs/reports as enrollment.
  return "enrollment"
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

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export function EventManagementReportsSectionHeader() {
  const pathname = usePathname()
  const isChildcare = pathname.startsWith("/event-management/reports/childcare")

  return (
    <div className="border-b border-border bg-card px-6 pt-6 pb-4">
      <nav className="mb-2 text-sm text-muted-foreground">
        <Link href="/event-management/overview" className="hover:text-foreground">
          Event Management
        </Link>
        <span className="mx-2">/</span>
        {isChildcare ? (
          <>
            <Link href="/event-management/reports" className="hover:text-foreground">
              Reports
            </Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">Childcare Registrations</span>
          </>
        ) : (
          <span className="text-foreground">Reports</span>
        )}
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight">
        {isChildcare ? "Childcare Registrations" : "Reports"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isChildcare
          ? "Manage child registrations across events. Open an event workspace for event-specific childcare."
          : "Ticketing analytics and event operational reporting."}
      </p>
    </div>
  )
}

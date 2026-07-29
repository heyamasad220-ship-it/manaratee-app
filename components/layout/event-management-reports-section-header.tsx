"use client"

import { PageBreadcrumbs } from "@/components/navigation/page-breadcrumbs"
import { EventManagementReportsTabNav } from "@/components/layout/event-management-reports-tab-nav"

export function EventManagementReportsSectionHeader() {
  return (
    <div className="border-b border-border bg-card px-6 pt-6">
      <PageBreadcrumbs
        className="mb-2"
        items={[
          {
            label: "Event Management",
            href: "/event-management/overview",
          },
          { label: "Reports" },
        ]}
      />
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Event operational reporting. Ticket sales analytics are under Ticketing
        → Reports.
      </p>
      <EventManagementReportsTabNav />
    </div>
  )
}

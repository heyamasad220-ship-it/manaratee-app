"use client"

import { usePathname } from "next/navigation"

import { PageBreadcrumbs } from "@/components/navigation/page-breadcrumbs"

export function EventManagementReportsSectionHeader() {
  const pathname = usePathname()
  const isChildcare = pathname.startsWith("/event-management/reports/childcare")

  return (
    <div className="border-b border-border bg-card px-6 pt-6 pb-4">
      <PageBreadcrumbs
        className="mb-2"
        items={
          isChildcare
            ? [
                {
                  label: "Event Management",
                  href: "/event-management/overview",
                },
                { label: "Reports", href: "/event-management/reports" },
                { label: "Childcare Registrations" },
              ]
            : [
                {
                  label: "Event Management",
                  href: "/event-management/overview",
                },
                { label: "Reports" },
              ]
        }
      />
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

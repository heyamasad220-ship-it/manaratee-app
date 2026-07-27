import { TicketingTabNav } from "@/components/layout/ticketing-tab-nav"
import { PageBreadcrumbs } from "@/components/navigation/page-breadcrumbs"

export function TicketingSectionHeader() {
  return (
    <div className="border-b border-border bg-card px-6 pt-6">
      <PageBreadcrumbs
        className="mb-2"
        items={[
          { label: "Event Management", href: "/event-management/overview" },
          { label: "Ticketing" },
        ]}
      />
      <h1 className="text-2xl font-semibold tracking-tight">Ticketing</h1>
      <div className="mt-4">
        <TicketingTabNav />
      </div>
    </div>
  )
}

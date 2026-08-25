import { EventManagementReportsNav } from "@/components/events/event-management-reports-nav"

export function EventManagementReportsHeader() {
  return (
    <div className="border-b border-border bg-background">
      <div className="px-6 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      </div>
      <div className="mt-4 px-2 sm:px-0">
        <EventManagementReportsNav />
      </div>
    </div>
  )
}

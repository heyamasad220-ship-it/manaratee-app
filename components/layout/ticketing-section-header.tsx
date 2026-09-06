import { TicketingTabNav } from "@/components/layout/ticketing-tab-nav"

export function TicketingSectionHeader() {
  return (
    <div className="border-b border-border bg-card px-6 pt-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ticketing</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sales, orders, and door check-in for every ticketed event — including
        campaign, department, and Event Management events.
      </p>
      <div className="mt-4">
        <TicketingTabNav />
      </div>
    </div>
  )
}

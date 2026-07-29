import { TicketingTabNav } from "@/components/layout/ticketing-tab-nav"

export function TicketingSectionHeader() {
  return (
    <div className="border-b border-border bg-card px-6 pt-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ticketing</h1>
      <div className="mt-4">
        <TicketingTabNav />
      </div>
    </div>
  )
}

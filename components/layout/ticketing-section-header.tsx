import Link from "next/link"

import { TicketingTabNav } from "@/components/layout/ticketing-tab-nav"

export function TicketingSectionHeader() {
  return (
    <div className="border-b border-border bg-card px-6 pt-6">
      <nav className="mb-2 text-sm text-muted-foreground">
        <Link href="/event-management/overview" className="hover:text-foreground">
          Event Management
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Ticketing</span>
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight">Ticketing</h1>
      <div className="mt-4">
        <TicketingTabNav />
      </div>
    </div>
  )
}

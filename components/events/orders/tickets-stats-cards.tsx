import { Card, CardContent } from "@/components/ui/card"
import type { TicketOverviewStats } from "@/lib/tickets/ticket-order-queries"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"

export function TicketsStatsCards({ stats }: { stats: TicketOverviewStats }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Card className="border border-border shadow-sm">
        <CardContent className="p-5">
          <p className="text-sm font-medium text-muted-foreground">Orders completed</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{stats.ordersCount}</p>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardContent className="p-5">
          <p className="text-sm font-medium text-muted-foreground">Tickets issued</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{stats.ticketsIssued}</p>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardContent className="p-5">
          <p className="text-sm font-medium text-muted-foreground">Total revenue</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {formatTicketPrice(stats.totalRevenueCents, stats.currency)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

import { Card, CardContent } from "@/components/ui/card"
import { overviewStats } from "@/lib/mock-data"

export function TicketsStatsCards() {
  const s = overviewStats

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card className="border border-border shadow-sm">
        <CardContent className="p-5">
          <p className="text-sm font-medium text-muted-foreground">Tickets Sold</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {s.ordersReceived}
          </p>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardContent className="p-5">
          <p className="text-sm font-medium text-muted-foreground">Tickets Issued</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {s.ticketsIssued}
          </p>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardContent className="p-5">
          <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            ${s.totalRevenue.amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{s.totalRevenue.label}</p>
        </CardContent>
      </Card>
    </div>
  )
}

import { Card, CardContent } from "@/components/ui/card"
import { overviewStats } from "@/lib/mock-data"

export function StatsCards() {
  const s = overviewStats

  return (
    <div className="flex flex-wrap gap-4 [&>*]:w-fit">
      <Card className="w-fit border border-border shadow-sm">
        <CardContent className="p-5">
          <p className="text-sm font-medium text-muted-foreground">Next Event In</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {s.nextEventIn.days} days
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {s.nextEventIn.eventName} &middot; {s.nextEventIn.date}
          </p>
        </CardContent>
      </Card>

      <Card className="w-fit border border-border shadow-sm">
        <CardContent className="p-5">
          <p className="text-sm font-medium text-muted-foreground">Published Events</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {s.publishedEvents.count}
          </p>
          <p className="mt-1 text-sm text-primary">{s.publishedEvents.label}</p>
        </CardContent>
      </Card>
    </div>
  )
}

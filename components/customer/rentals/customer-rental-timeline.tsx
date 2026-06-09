import { Check, Circle, CircleDot, X } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CustomerTimelineStage } from "@/lib/bookings/customer-venue-rental-experience"
import { cn } from "@/lib/utils"

type CustomerRentalTimelineProps = {
  stages: CustomerTimelineStage[]
}

function StageIcon({ state }: { state: CustomerTimelineStage["state"] }) {
  if (state === "complete") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <Check className="h-3.5 w-3.5" />
      </span>
    )
  }

  if (state === "current") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-800">
        <CircleDot className="h-3.5 w-3.5" />
      </span>
    )
  }

  if (state === "cancelled") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <X className="h-3.5 w-3.5" />
      </span>
    )
  }

  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground">
      <Circle className="h-3.5 w-3.5" />
    </span>
  )
}

export function CustomerRentalTimeline({ stages }: CustomerRentalTimelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Status timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-0">
          {stages.map((stage, index) => (
            <li key={stage.id} className="relative flex gap-3 pb-6 last:pb-0">
              {index < stages.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-3 top-6 h-[calc(100%-0.5rem)] w-px -translate-x-1/2",
                    stage.state === "complete" ? "bg-emerald-200" : "bg-border"
                  )}
                />
              ) : null}
              <div className="relative z-10 shrink-0">
                <StageIcon state={stage.state} />
              </div>
              <div className="min-w-0 pt-0.5">
                <p
                  className={cn(
                    "text-sm font-medium capitalize",
                    stage.state === "current" && "text-amber-900",
                    stage.state === "cancelled" && "text-muted-foreground line-through",
                    stage.state === "upcoming" && "text-muted-foreground"
                  )}
                >
                  {stage.label}
                </p>
                {stage.dateLabel ? (
                  <p className="text-xs text-muted-foreground">{stage.dateLabel}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

import Link from "next/link"
import { AlertCircle, Calendar, Clock, MapPin } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { CustomerRentalFinancialContext } from "@/lib/bookings/customer-venue-rental-dtos"
import {
  getCustomerRentalCardSummary,
  getCustomerRentalNextStepLabel,
  getCustomerRentalStatusHeadline,
} from "@/lib/bookings/customer-venue-rental-experience"
import type { VenueRentalQueueRow } from "@/lib/bookings/venue-rental-types"
import { cn } from "@/lib/utils"

type VenueRentalRequestCardProps = {
  rental: VenueRentalQueueRow
  financialContext?: CustomerRentalFinancialContext
  variant?: "active" | "past"
}

export function VenueRentalRequestCard({
  rental,
  financialContext,
  variant = "active",
}: VenueRentalRequestCardProps) {
  const summary = getCustomerRentalCardSummary(rental, financialContext)
  const statusHeadline = getCustomerRentalStatusHeadline(rental, financialContext)
  const nextStepLabel = getCustomerRentalNextStepLabel(rental, financialContext)
  const needsAction = summary.nextAction.requiresAction

  if (variant === "past") {
    return (
      <Link href={`/customer/rentals/${rental.id}`}>
        <Card className="transition-colors hover:bg-muted/50">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0 space-y-1">
              <p className="font-medium truncate">
                {rental.eventTypeName || "Venue rental"}
              </p>
              <p className="text-sm text-muted-foreground">
                {summary.venueLabel} · {summary.dateLabel}
              </p>
              <Badge
                variant="secondary"
                className={cn(summary.colors.bg, summary.colors.text)}
              >
                {statusHeadline}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  return (
    <Card
      className={cn(
        "overflow-hidden shadow-sm transition-shadow hover:shadow-md",
        needsAction && "border-amber-300 bg-gradient-to-br from-amber-50/80 to-background"
      )}
    >
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">
            {rental.eventTypeName || "Venue rental"}
          </h2>

          <div className="space-y-1.5 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              {summary.venueLabel}
            </p>
            <p className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0" />
              {summary.dateLabel}
            </p>
            {summary.timeLabel ? (
              <p className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0" />
                {summary.timeLabel}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border bg-background/60 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </p>
            <p className="mt-1 font-medium">{statusHeadline}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Next step
            </p>
            <p
              className={cn(
                "mt-1 flex items-center gap-1.5 font-medium",
                needsAction ? "text-amber-900" : "text-muted-foreground"
              )}
            >
              {needsAction ? (
                <AlertCircle className="h-4 w-4 shrink-0" />
              ) : null}
              {nextStepLabel}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button asChild variant={needsAction ? "default" : "outline"}>
            <Link href={`/customer/rentals/${rental.id}`}>View details</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

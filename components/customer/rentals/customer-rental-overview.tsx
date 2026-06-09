import { Building2, Calendar, Clock, Users } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getAllVenueLabels,
  getPrimaryDateLabel,
  getPrimaryTimeLabel,
  getCustomerFriendlyStatusLabel,
} from "@/lib/bookings/customer-venue-rental-experience"
import type { VenueRentalQueueRow } from "@/lib/bookings/venue-rental-types"

type CustomerRentalOverviewProps = {
  rental: VenueRentalQueueRow
}

function OverviewItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}

export function CustomerRentalOverview({ rental }: CustomerRentalOverviewProps) {
  const guestLabel =
    rental.guestCount != null && rental.guestCount > 0
      ? `${rental.guestCount} guest${rental.guestCount === 1 ? "" : "s"}`
      : "Not provided"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rental overview</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <OverviewItem
          icon={Building2}
          label="Event type"
          value={rental.eventTypeName || "Venue rental"}
        />
        <OverviewItem icon={Building2} label="Venue(s)" value={getAllVenueLabels(rental)} />
        <OverviewItem icon={Calendar} label="Date" value={getPrimaryDateLabel(rental)} />
        <OverviewItem icon={Clock} label="Time" value={getPrimaryTimeLabel(rental) || "TBD"} />
        <OverviewItem icon={Users} label="Guest count" value={guestLabel} />
        <OverviewItem
          icon={Calendar}
          label="Status"
          value={getCustomerFriendlyStatusLabel(rental.status)}
        />
        <OverviewItem
          icon={Calendar}
          label="Request submitted"
          value={rental.submittedAtLabel}
        />
      </CardContent>
    </Card>
  )
}

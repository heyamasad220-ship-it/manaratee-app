import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatVenueRentalTimeRange } from "@/lib/bookings/venue-rental-format"
import {
  getAllVenueLabels,
  getPrimaryDateLabel,
  getPrimaryTimeLabel,
} from "@/lib/bookings/customer-venue-rental-experience"
import type { VenueRentalQueueRow } from "@/lib/bookings/venue-rental-types"

type CustomerRentalRentalDetailsSectionProps = {
  rental: VenueRentalQueueRow
}

export function CustomerRentalRentalDetailsSection({
  rental,
}: CustomerRentalRentalDetailsSectionProps) {
  const guestLabel =
    rental.guestCount != null && rental.guestCount > 0
      ? `${rental.guestCount} guest${rental.guestCount === 1 ? "" : "s"}`
      : "Not provided"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rental details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Event type</dt>
            <dd className="font-medium">{rental.eventTypeName || "Venue rental"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Venue(s)</dt>
            <dd className="font-medium">{getAllVenueLabels(rental)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Event date</dt>
            <dd className="font-medium">{getPrimaryDateLabel(rental)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Time</dt>
            <dd className="font-medium">{getPrimaryTimeLabel(rental) || "TBD"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Guest count</dt>
            <dd className="font-medium">{guestLabel}</dd>
          </div>
        </dl>

        {rental.spaces.length > 1 ? (
          <div className="space-y-2">
            <p className="font-medium">Schedule by space</p>
            {rental.spaces.map((space) => (
              <div
                key={`${space.venueId}-${space.startAt}`}
                className="rounded border p-3"
              >
                <p className="font-medium">{space.venueName}</p>
                <p className="text-muted-foreground">
                  {formatVenueRentalTimeRange(space.startAt, space.endAt)}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {rental.addons.length ? (
          <div>
            <p className="mb-2 font-medium">Add-ons selected</p>
            <ul className="space-y-1 text-muted-foreground">
              {rental.addons.map((addon) => (
                <li key={addon.id}>
                  {addon.name} × {addon.quantity}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-muted-foreground">No add-ons selected.</p>
        )}

        {rental.notes ? (
          <div>
            <p className="mb-1 font-medium">Your notes</p>
            <p className="whitespace-pre-wrap text-muted-foreground">{rental.notes}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

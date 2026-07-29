import { redirect } from "next/navigation"

/** Venue rental event types live under Venue Rentals → Settings → Event Types.
 * Event Management will get its own event-type catalog later. */
export default function EventManagementEventTypesRedirectPage() {
  redirect("/bookings/settings/event-types")
}

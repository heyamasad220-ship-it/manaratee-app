import { redirect } from "next/navigation"

/** Venue rental event types live under Venue Rentals → Settings → Event Types. */
export default function FacilitiesEventTypesSettingsRedirectPage() {
  redirect("/bookings/settings/event-types")
}

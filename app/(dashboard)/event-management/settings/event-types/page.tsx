import { redirect } from "next/navigation"

/** Venue rental event types are managed under Bookings → Settings → Event Types. */
export default function EventTypesSettingsRedirectPage() {
  redirect("/facilities/settings/event-types")
}

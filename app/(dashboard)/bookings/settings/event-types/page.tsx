import { redirect } from "next/navigation"

/** Event types moved to Bookings → Settings → Event Types. */
export default function BookingsEventTypesSettingsRedirectPage() {
  redirect("/facilities/settings/event-types")
}

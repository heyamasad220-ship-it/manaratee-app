import { redirect } from "next/navigation"

export default function LegacyVenueRentalsCalendarRedirect() {
  redirect("/bookings/calendar")
}

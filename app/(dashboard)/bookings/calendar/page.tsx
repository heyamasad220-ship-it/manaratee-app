import { redirect } from "next/navigation"

export default function BookingsCalendarRedirectPage() {
  redirect("/facilities/calendar?sources=venue_rental")
}

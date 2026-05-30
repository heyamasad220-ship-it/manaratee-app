import { redirect } from "next/navigation"

export default function CustomerCalendarRedirectPage() {
  redirect("/customer/venue-availability")
}
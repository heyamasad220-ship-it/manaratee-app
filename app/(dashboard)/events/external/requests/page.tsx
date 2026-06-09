import { redirect } from "next/navigation"

export default function ExternalRequestsRedirectPage() {
  redirect("/bookings/requests")
}

import { redirect } from "next/navigation"

/** Legacy Space Availability route — merged into Bookings → Calendar. */
export default function FacilitiesAvailabilityRedirectPage() {
  redirect("/facilities/calendar")
}

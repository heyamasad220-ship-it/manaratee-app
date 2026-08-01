import { redirect } from "next/navigation"

/** Legacy Policies URL → General. */
export default function VenueRentalPoliciesSettingsRedirect() {
  redirect("/bookings/settings/general")
}

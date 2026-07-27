import { redirect } from "next/navigation"

/** Setup Styles moved to Bookings → Settings. */
export default function EventManagementSetupStylesRedirectPage() {
  redirect("/facilities/settings/setup-styles")
}

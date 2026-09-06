import { redirect } from "next/navigation"

export default function TicketingSettingsRedirectPage() {
  redirect("/event-management/settings/general")
}

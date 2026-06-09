import { redirect } from "next/navigation"

export default function LegacyEventsCalendarRedirect() {
  redirect("/event-management/calendar")
}

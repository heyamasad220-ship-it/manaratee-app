import { redirect } from "next/navigation"

export default function EventManagementCalendarRedirectPage() {
  redirect("/facilities/calendar?sources=internal_event")
}

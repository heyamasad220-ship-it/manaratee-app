import { redirect } from "next/navigation"

import { EVENT_MANAGEMENT_TICKETS_REPORTS_PATH } from "@/lib/events/event-management-reports-path"

export default function TicketsReportsRedirectPage() {
  redirect(EVENT_MANAGEMENT_TICKETS_REPORTS_PATH)
}

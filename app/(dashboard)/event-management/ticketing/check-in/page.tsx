import { redirect } from "next/navigation"

import { EVENT_MANAGEMENT_CHECK_IN_PATH } from "@/lib/events/event-management-section-path"

export default function EventManagementTicketingCheckInPage() {
  redirect(EVENT_MANAGEMENT_CHECK_IN_PATH)
}

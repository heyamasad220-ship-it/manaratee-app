import { redirect } from "next/navigation"

import { EVENT_MANAGEMENT_TICKETING_CHECK_IN_PATH } from "@/lib/events/event-management-section-path"

export default function EventManagementCheckInRedirectPage() {
  redirect(EVENT_MANAGEMENT_TICKETING_CHECK_IN_PATH)
}

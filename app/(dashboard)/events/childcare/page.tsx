import { redirect } from "next/navigation"

import { EVENT_MANAGEMENT_CHILDCARE_REPORTS_PATH } from "@/lib/events/event-management-reports-path"

export default function EventsChildcareRedirectPage() {
  redirect(EVENT_MANAGEMENT_CHILDCARE_REPORTS_PATH)
}

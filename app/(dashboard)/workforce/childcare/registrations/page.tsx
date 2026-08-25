import { redirect } from "next/navigation"

import { EVENT_MANAGEMENT_CHILDCARE_REPORTS_PATH } from "@/lib/events/event-management-reports-path"

export default function WorkforceChildcareRegistrationsRedirectPage() {
  redirect(EVENT_MANAGEMENT_CHILDCARE_REPORTS_PATH)
}

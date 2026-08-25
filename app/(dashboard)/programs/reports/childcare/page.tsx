import { redirect } from "next/navigation"

import { EVENT_MANAGEMENT_CHILDCARE_REPORTS_PATH } from "@/lib/events/event-management-reports-path"

/** Childcare reports live under Event Management → Reports → Childcare. */
export default function ProgramsChildcareRegistrationsRedirectPage() {
  redirect(EVENT_MANAGEMENT_CHILDCARE_REPORTS_PATH)
}

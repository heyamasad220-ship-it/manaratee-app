import { redirect } from "next/navigation"

/** Event Management Reports removed — childcare lives under Programs/ Events → Reports. */
export default function EventManagementReportsRedirectPage() {
  redirect("/programs/reports/childcare")
}

import { redirect } from "next/navigation"

import { EVENT_MANAGEMENT_ORDERS_REPORTS_PATH } from "@/lib/events/event-management-reports-path"

export default function EventManagementReportsPage() {
  redirect(EVENT_MANAGEMENT_ORDERS_REPORTS_PATH)
}

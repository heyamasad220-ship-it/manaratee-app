import { redirect } from "next/navigation"

import { EVENT_MANAGEMENT_TICKETS_REPORTS_PATH } from "@/lib/events/event-management-reports-path"

export default async function EventManagementTicketingReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolved = await searchParams
  const rangeParam = resolved?.range
  const range = Array.isArray(rangeParam) ? rangeParam[0] : rangeParam
  const query = range ? `?range=${encodeURIComponent(range)}` : ""
  redirect(`${EVENT_MANAGEMENT_TICKETS_REPORTS_PATH}${query}`)
}

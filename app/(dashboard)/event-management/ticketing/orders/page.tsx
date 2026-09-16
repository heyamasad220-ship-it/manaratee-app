import { redirect } from "next/navigation"

import { eventManagementOrdersHref } from "@/lib/events/event-management-reports-path"

export default async function EventManagementTicketingOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>
}) {
  const params = await searchParams
  redirect(eventManagementOrdersHref(params.event))
}

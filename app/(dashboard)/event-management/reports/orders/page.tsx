import { redirect } from "next/navigation"

import { eventManagementOrdersHref } from "@/lib/events/event-management-reports-path"

export default async function EventManagementOrdersReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>
}) {
  const params = await searchParams
  redirect(eventManagementOrdersHref(params.event))
}

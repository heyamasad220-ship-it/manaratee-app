import { redirect } from "next/navigation"

import { eventTicketingWorkspaceHref } from "@/lib/events/event-management-section-path"
import { getBazaarWorkspaceHrefForInternalEvent } from "@/lib/vendor-hub/vendor-hub-internal-event-queries"

export default async function EventTicketingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ section?: string }>
}) {
  const { id } = await params
  const bazaarHref = await getBazaarWorkspaceHrefForInternalEvent(id)
  if (bazaarHref) {
    redirect(bazaarHref)
  }
  const { section } = await searchParams
  redirect(eventTicketingWorkspaceHref(id, section ?? "settings"))
}

import { notFound } from "next/navigation"
import { Suspense } from "react"

import { InternalEventWorkspace } from "@/components/events/internal-event-workspace"
import { getChildcareForInternalEvent } from "@/lib/child-care/childcare-registration-queries"
import { getInternalEventById } from "@/lib/events/internal-event-queries"
import { getParticipationsForSource } from "@/lib/service-participations/service-participation-queries"
import { getEventTicketTypes } from "@/lib/tickets/ticket-type-actions"
import {
  hasAnyPermission,
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

const WORKSPACE_TABS = [
  "overview",
  "ticketing",
  "volunteers",
  "childcare",
  "vendors",
] as const

type WorkspaceTab = (typeof WORKSPACE_TABS)[number]

function parseWorkspaceTab(value: string | undefined): WorkspaceTab {
  if (value && WORKSPACE_TABS.includes(value as WorkspaceTab)) {
    return value as WorkspaceTab
  }
  return "overview"
}

export default async function InternalEventWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  await requireAnyPermission(PERMISSIONS.EVENTS_VIEW, PERMISSIONS.PROGRAMS_VIEW)

  const { id } = await params
  const { tab } = await searchParams
  const initialTab = parseWorkspaceTab(tab)

  const [event, canManage, participations, ticketTypes, childcare] = await Promise.all([
    getInternalEventById(id),
    hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
    getParticipationsForSource({ sourceType: "internal_event", sourceId: id }),
    getEventTicketTypes(id),
    getChildcareForInternalEvent(id),
  ])

  if (!event) {
    notFound()
  }

  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading event...</div>}>
      <InternalEventWorkspace
        event={event}
        canManage={canManage}
        participations={participations}
        ticketTypes={ticketTypes}
        childcareEvent={childcare.childcareEvent}
        childcareRegistrations={childcare.registrations}
        initialTab={initialTab}
      />
    </Suspense>
  )
}

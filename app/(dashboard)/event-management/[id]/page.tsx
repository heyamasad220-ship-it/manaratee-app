import { notFound } from "next/navigation"
import { Suspense } from "react"

import { InternalEventWorkspace } from "@/components/events/internal-event-workspace"
import { getChildcareForInternalEvent } from "@/lib/child-care/childcare-registration-queries"
import { listEventExpenses } from "@/lib/events/event-expense-actions"
import { getLinkedCampaignSummary, listActiveCampaignsForEvent } from "@/lib/events/event-finance-queries"
import { linkedCampaignIdFromConfig } from "@/lib/events/event-finance-types"
import { getEventOverviewSummary } from "@/lib/events/event-overview-metrics"
import { getInternalEventDeleteBlockers } from "@/lib/events/internal-event-actions"
import { getInternalEventById } from "@/lib/events/internal-event-queries"
import { resolveWorkspaceTabId } from "@/lib/events/event-workspace-features"
import { getParticipationsForSource } from "@/lib/service-participations/service-participation-queries"
import { getEventTicketTypes } from "@/lib/tickets/ticket-type-actions"
import { getEventAttendees } from "@/lib/tickets/ticket-order-queries"
import { getEventStaffCandidates } from "@/lib/events/event-staff-assignment-queries"
import { getVendorHubVendorTypes } from "@/lib/vendor-hub/vendor-type-queries"
import { getVendorHubLinkForInternalEvent } from "@/lib/vendor-hub/vendor-hub-internal-event-queries"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { listEventDocuments } from "@/lib/events/event-document-actions"
import {
  canManageInternalEvent,
  hasEventCheckInPermission,
  requireInternalEventWorkspaceAccess,
} from "@/lib/events/event-access"

export default async function InternalEventWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  await requireInternalEventWorkspaceAccess(id)
  const { tab } = await searchParams
  const initialTab = resolveWorkspaceTabId(tab) ?? "overview"

  const [
    event,
    canManage,
    canCheckIn,
    participations,
    ticketTypes,
    attendees,
    childcare,
    vendorTypes,
    expenses,
  ] = await Promise.all([
    getInternalEventById(id),
    canManageInternalEvent(id),
    hasEventCheckInPermission(),
    getParticipationsForSource({ sourceType: "internal_event", sourceId: id }),
    getEventTicketTypes(id),
    getEventAttendees(id),
    getChildcareForInternalEvent(id),
    getVendorHubVendorTypes({ activeOnly: true }),
    listEventExpenses(id),
  ])

  if (!event) {
    notFound()
  }

  const staffCandidates = await getEventStaffCandidates({
    departmentId: event.department_id,
  })

  const coordinatorCandidates = staffCandidates.map((candidate) => ({
    id: candidate.id,
    full_name: candidate.full_name,
  }))

  const coordinatorName = event.coordinator_contact_id
    ? coordinatorCandidates.find(
        (candidate) => candidate.id === event.coordinator_contact_id
      )?.full_name ?? null
    : null

  const linkedCampaignId = linkedCampaignIdFromConfig(event.ticketing_config)

  const organizationId = await getSelectedOrganizationId()
  let organizationSlug: string | null = null
  if (organizationId) {
    const admin = getServiceRoleClient()
    const { data: org } = await admin
      .from("organizations")
      .select("slug")
      .eq("id", organizationId)
      .maybeSingle()
    organizationSlug = (org?.slug as string | undefined) ?? null
  }

  const [linkedCampaignSummary, campaignOptions, vendorHubLink, eventDocuments] =
    await Promise.all([
      getLinkedCampaignSummary(linkedCampaignId),
      listActiveCampaignsForEvent(),
      getVendorHubLinkForInternalEvent(id),
      listEventDocuments(id),
    ])

  const overview = await getEventOverviewSummary({
    eventId: id,
    event,
    attendees,
    participations,
    childcareRegistrations: childcare.registrations,
    linkedCampaignRaisedCents: linkedCampaignSummary?.raisedCents ?? 0,
  })

  const deleteBlockedReason = canManage
    ? await getInternalEventDeleteBlockers(id)
    : null

  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">Loading event...</div>
      }
    >
      <InternalEventWorkspace
        event={event}
        canManage={canManage}
        canCheckIn={canCheckIn}
        deleteBlockedReason={deleteBlockedReason}
        participations={participations}
        ticketTypes={ticketTypes}
        attendees={attendees}
        staffCandidates={staffCandidates}
        coordinatorCandidates={coordinatorCandidates}
        coordinatorName={coordinatorName}
        childcareEvent={childcare.childcareEvent}
        childcareRegistrations={childcare.registrations}
        vendorTypes={vendorTypes}
        overview={overview}
        expenses={expenses}
        linkedCampaignId={linkedCampaignId}
        linkedCampaignSummary={linkedCampaignSummary}
        campaignOptions={campaignOptions}
        vendorHubLink={vendorHubLink}
        eventDocuments={eventDocuments}
        organizationSlug={organizationSlug}
        initialTab={initialTab}
      />
    </Suspense>
  )
}

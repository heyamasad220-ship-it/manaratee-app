"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Building2, Calendar, MapPin, Tag } from "lucide-react"

import { Header } from "@/components/layout/header"
import { InternalEventCardActions } from "@/components/events/internal-event-card-actions"
import { InternalEventChildcareTab } from "@/components/events/internal-event-childcare-tab"
import { InternalEventCommunityCalendarCard } from "@/components/events/internal-event-community-calendar-card"
import { InternalEventDescriptionCard } from "@/components/events/internal-event-description-card"
import { InternalEventFeaturesSettings } from "@/components/events/internal-event-features-settings"
import { InternalEventMetaSettings } from "@/components/events/internal-event-meta-settings"
import { InternalEventServiceNeedsSettings } from "@/components/events/internal-event-service-needs-settings"
import { InternalEventFinanceTab } from "@/components/events/internal-event-finance-tab"
import { InternalEventFlyerCard } from "@/components/events/internal-event-flyer-card"
import { InternalEventModuleSetupPanel } from "@/components/events/internal-event-module-setup-panel"
import { InternalEventModuleDisabledState } from "@/components/events/internal-event-participations-panel"
import { InternalEventAttendeesTab } from "@/components/events/internal-event-attendees-tab"
import { InternalEventOverviewDashboard } from "@/components/events/internal-event-overview-dashboard"
import { InternalEventRegistrationWorkspace } from "@/components/events/internal-event-registration-workspace"
import { InternalEventReportsTab } from "@/components/events/internal-event-reports-tab"
import {
  getEventTaskDefinitionsFromRequirements,
  getEventTaskNamesFromRequirements,
  InternalEventStaffAssignments,
} from "@/components/events/internal-event-staff-tab"
import { InternalEventSettingsWorkspace } from "@/components/events/internal-event-settings-workspace"
import { InternalEventVendorsTab } from "@/components/events/internal-event-vendors-tab"
import { InternalEventStatusSelect } from "@/components/events/internal-event-status-select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatInternalEventLocation } from "@/lib/events/internal-event-location"
import { buildEventRecentOrders } from "@/lib/events/event-recent-activity"
import type { EventOverviewSummary } from "@/lib/events/event-overview-metrics"
import type { EventExpense } from "@/lib/events/event-expense-types"
import type {
  EventCampaignOption,
  LinkedCampaignSummary,
} from "@/lib/events/event-finance-types"
import {
  getVisibleWorkspaceTabs,
  resolveAttendanceMode,
  resolveEventWorkspaceFeatures,
  resolveWorkspaceTabId,
  type EventWorkspaceTabId,
} from "@/lib/events/event-workspace-features"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"
import type {
  ChildcareEventSummary,
  ChildcareRegistration,
} from "@/lib/child-care/childcare-registration-types"
import type { EventAttendeeListItem } from "@/lib/tickets/ticket-order-queries"
import type { EventStaffCandidate } from "@/lib/events/event-staff-assignment-queries"
import type { EventTicketType } from "@/lib/tickets/ticket-types"
import type { ServiceParticipationWithContact } from "@/lib/service-participations/service-participation-types"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"
import type { VendorHubLinkForInternalEvent } from "@/lib/vendor-hub/vendor-hub-internal-event-queries"
import type { EventDocument } from "@/lib/events/event-document-types"
import { InternalEventDocumentsCard } from "@/components/events/internal-event-documents-card"

function formatDateTime(value: string | null) {
  if (!value) {
    return "TBD"
  }

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function InternalEventWorkspace({
  event,
  canManage,
  canCheckIn = false,
  deleteBlockedReason = null,
  participations = [],
  ticketTypes = [],
  attendees = [],
  staffCandidates = [],
  coordinatorCandidates = [],
  coordinatorName = null,
  childcareEvent = null,
  childcareRegistrations = [],
  vendorTypes = [],
  overview,
  expenses = [],
  linkedCampaignId = null,
  linkedCampaignSummary = null,
  campaignOptions = [],
  vendorHubLink = null,
  eventDocuments = [],
  organizationSlug = null,
  initialTab = "overview",
}: {
  event: InternalEventWithRelations
  canManage: boolean
  canCheckIn?: boolean
  deleteBlockedReason?: string | null
  participations?: ServiceParticipationWithContact[]
  ticketTypes?: EventTicketType[]
  attendees?: EventAttendeeListItem[]
  staffCandidates?: EventStaffCandidate[]
  coordinatorCandidates?: Array<{ id: string; full_name: string }>
  coordinatorName?: string | null
  childcareEvent?: ChildcareEventSummary | null
  childcareRegistrations?: ChildcareRegistration[]
  vendorTypes?: VendorHubVendorType[]
  overview: EventOverviewSummary
  expenses?: EventExpense[]
  linkedCampaignId?: string | null
  linkedCampaignSummary?: LinkedCampaignSummary | null
  campaignOptions?: EventCampaignOption[]
  vendorHubLink?: VendorHubLinkForInternalEvent | null
  eventDocuments?: EventDocument[]
  organizationSlug?: string | null
  initialTab?: EventWorkspaceTabId
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const resolvedFromUrl = resolveWorkspaceTabId(tabParam)

  const features = resolveEventWorkspaceFeatures(event)
  const attendanceMode = resolveAttendanceMode(event)
  const hasStaffAssignments = participations.some(
    (row) =>
      (row.participation_type === "staff" ||
        row.participation_type === "volunteer") &&
      row.status !== "cancelled"
  )
  const hasFinancialActivity =
    overview.finance.ticketRevenueCents > 0 ||
    overview.finance.expenseCents > 0 ||
    expenses.length > 0

  const visibleTabs = getVisibleWorkspaceTabs({
    features,
    attendanceMode,
    hasAttendees: attendees.length > 0,
    hasStaffAssignments,
    hasFinancialActivity,
  })

  const activeTab: EventWorkspaceTabId = (() => {
    const candidate = resolvedFromUrl ?? initialTab
    if (visibleTabs.some((tab) => tab.value === candidate)) return candidate
    return "overview"
  })()

  const departmentName = event.departments?.name || "Unknown department"
  const eventTypeName = event.event_types?.name || "Unknown type"

  const vendorParticipations = participations.filter(
    (row) => row.participation_type === "vendor"
  )
  const providerParticipations = participations.filter(
    (row) => row.participation_type === "childcare_provider"
  )
  const staffTasks = getEventTaskNamesFromRequirements(event.service_requirements)
  const staffTaskDefinitions = getEventTaskDefinitionsFromRequirements(
    event.service_requirements
  )
  const recentActivity = buildEventRecentOrders(attendees, 4)

  function handleTabChange(value: string) {
    const nextTab = resolveWorkspaceTabId(value)
    if (!nextTab) return
    if (!visibleTabs.some((tab) => tab.value === nextTab)) return
    // Radix can emit onValueChange for the already-selected tab after RSC
    // refresh. Replacing the same URL retriggers the refresh and loops.
    if (tabParam === nextTab || (!tabParam && nextTab === activeTab)) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", nextTab)
    const nextHref = `/event-management/${event.id}?${params.toString()}`
    const currentHref = `/event-management/${event.id}?${searchParams.toString()}`
    if (nextHref === currentHref) return
    router.replace(nextHref, {
      scroll: false,
    })
  }

  const overviewDetails = (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <InternalEventFlyerCard
          eventId={event.id}
          flyerUrl={event.flyer_url ?? null}
          canManage={canManage}
        />

        <InternalEventDescriptionCard
          eventId={event.id}
          description={event.description}
          canManage={canManage}
        />
      </div>

      <div className="space-y-6">
        <Card
          className={
            canManage
              ? "cursor-pointer transition-colors hover:bg-muted/30"
              : undefined
          }
          onClick={
            canManage
              ? () => router.push(`/event-management/${event.id}/edit`)
              : undefined
          }
          role={canManage ? "link" : undefined}
          tabIndex={canManage ? 0 : undefined}
          onKeyDown={
            canManage
              ? (keyboardEvent) => {
                  if (
                    keyboardEvent.key === "Enter" ||
                    keyboardEvent.key === " "
                  ) {
                    keyboardEvent.preventDefault()
                    router.push(`/event-management/${event.id}/edit`)
                  }
                }
              : undefined
          }
        >
          <CardHeader>
            <CardTitle className="text-base">Event details</CardTitle>
            {canManage ? (
              <p className="text-xs font-normal text-muted-foreground">
                Click to edit schedule and location
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Department</p>
                <p className="text-muted-foreground">{departmentName}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Tag className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Event type</p>
                <p className="text-muted-foreground">{eventTypeName}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Schedule</p>
                <p className="text-muted-foreground">
                  {formatDateTime(event.start_at)} –{" "}
                  {formatDateTime(event.end_at)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Location</p>
                <p className="text-muted-foreground">
                  {formatInternalEventLocation(event)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <InternalEventCommunityCalendarCard
          eventId={event.id}
          eventName={event.name}
          communityCalendarStatus={event.community_calendar_status}
          organizationSlug={organizationSlug}
          canManage={canManage}
        />
      </div>
    </div>
  )

  return (
    <>
      <Header title="Event Management" />

      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Event workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {event.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {departmentName} · {eventTypeName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{overview.operationalPhaseLabel}</Badge>
            {canManage ? (
              <InternalEventStatusSelect
                eventId={event.id}
                status={event.status}
              />
            ) : null}
            {canManage ? (
              <InternalEventCardActions
                eventId={event.id}
                eventName={event.name}
                showEdit={false}
                deleteBlockedReason={deleteBlockedReason}
                redirectAfterDelete="/event-management/events"
              />
            ) : null}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-4">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            {visibleTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <InternalEventOverviewDashboard
              overview={overview}
              canManage={canManage}
              eventId={event.id}
              coordinatorName={coordinatorName}
              details={overviewDetails}
              recentActivity={recentActivity}
              onNavigateTab={handleTabChange}
            />
          </TabsContent>

          <TabsContent value="registration" className="mt-0">
            <InternalEventRegistrationWorkspace
              eventId={event.id}
              ticketTypes={ticketTypes}
              ticketingConfig={event.ticketing_config}
              requiresTicketing={event.requires_ticketing}
              canManage={canManage}
            />
          </TabsContent>

          <TabsContent value="attendees" className="mt-0">
            {attendanceMode !== "open_public" || attendees.length > 0 ? (
              <InternalEventAttendeesTab
                eventId={event.id}
                attendees={attendees}
                ticketTypes={ticketTypes}
                canManage={canManage}
                canCheckIn={canCheckIn || canManage}
                waitlistEnabled={features.waitlist}
              />
            ) : (
              <InternalEventModuleDisabledState
                title="Attendees"
                description="This event is open to the public without registration. Change the attendance method under Registration to collect attendee records."
              />
            )}
          </TabsContent>

          <TabsContent value="staff" className="mt-0">
            <div className="space-y-6">
              {canManage ? (
                <InternalEventModuleSetupPanel
                  event={event}
                  module="volunteers"
                  staffMode
                  title="Tasks & volunteer sign-ups"
                  description="Create roles/tasks for assignments and optionally open volunteer sign-ups."
                />
              ) : null}
              <InternalEventStaffAssignments
                eventId={event.id}
                tasks={staffTasks}
                taskDefinitions={staffTaskDefinitions}
                participations={participations}
                candidates={staffCandidates}
                canManage={canManage}
              />
            </div>
          </TabsContent>

          <TabsContent value="youth" className="mt-0">
            {features.youth ? (
              <div className="space-y-6">
                {canManage ? (
                  <InternalEventModuleSetupPanel
                    event={event}
                    module="childcare"
                    title="Youth offerings"
                    description="Configure childcare and field trip groups, capacity, and registration deadlines."
                  />
                ) : null}
                <InternalEventChildcareTab
                  event={event}
                  childcareEvent={childcareEvent}
                  registrations={childcareRegistrations}
                  providerParticipations={providerParticipations}
                  canManage={canManage}
                  canCheckIn={canCheckIn || canManage}
                />
              </div>
            ) : canManage ? (
              <InternalEventModuleSetupPanel
                event={event}
                module="childcare"
                title="Youth"
                description="Enable youth offerings (childcare and field trips) to register children and assign providers for this event."
              />
            ) : (
              <InternalEventModuleDisabledState
                title="Youth"
                description="Youth offerings are not enabled for this event."
              />
            )}
          </TabsContent>

          <TabsContent value="vendors" className="mt-0">
            {features.vendors ? (
              <div className="space-y-6">
                {canManage ? (
                  <InternalEventModuleSetupPanel
                    event={event}
                    module="vendors"
                    vendorTypes={vendorTypes}
                    title="Vendor settings"
                    description="Update vendor types, fees, and application settings."
                  />
                ) : null}
                <InternalEventVendorsTab
                  event={event}
                  participations={vendorParticipations}
                  canManage={canManage}
                  vendorHubLink={vendorHubLink}
                />
              </div>
            ) : canManage ? (
              <InternalEventModuleSetupPanel
                event={event}
                module="vendors"
                vendorTypes={vendorTypes}
                title="Vendors"
                description="Enable vendors to accept applications and manage booth participation."
              />
            ) : (
              <InternalEventModuleDisabledState
                title="Vendors"
                description="Vendors are not enabled for this event."
              />
            )}
          </TabsContent>

          <TabsContent value="finance" className="mt-0">
            <InternalEventFinanceTab
              eventId={event.id}
              initialExpenses={expenses}
              financeSummary={overview.finance}
              linkedCampaignId={linkedCampaignId}
              linkedCampaignSummary={linkedCampaignSummary}
              campaignOptions={campaignOptions}
              canManage={canManage}
            />
          </TabsContent>

          <TabsContent value="reports" className="mt-0">
            <InternalEventReportsTab
              eventId={event.id}
              attendees={attendees}
              overview={overview}
              staffParticipations={participations}
              youthRegistrations={childcareRegistrations}
              vendorParticipations={vendorParticipations}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <div className="space-y-6">
              <InternalEventServiceNeedsSettings
                key={event.id}
                event={event}
                vendorTypes={vendorTypes}
                canManage={canManage}
                canManageVendorTypes={canManage}
              />
              <InternalEventFeaturesSettings
                eventId={event.id}
                initialFeatures={features}
                canManage={canManage}
              />
              <InternalEventMetaSettings
                eventId={event.id}
                coordinatorCandidates={coordinatorCandidates}
                initialCoordinatorContactId={
                  event.coordinator_contact_id ?? null
                }
                initialAudience={event.audience}
                initialEventTags={event.event_tags}
                initialEstimatedAttendance={event.estimated_attendance ?? null}
                initialInternalNotes={event.internal_notes ?? null}
                canManage={canManage}
              />
              <InternalEventDocumentsCard
                eventId={event.id}
                documents={eventDocuments}
                canManage={canManage}
              />
              {features.registration && attendanceMode !== "open_public" ? (
                <InternalEventSettingsWorkspace
                  eventId={event.id}
                  eventName={event.name}
                  ticketTypes={ticketTypes}
                  ticketingConfig={event.ticketing_config}
                  canManage={canManage}
                />
              ) : canManage ? (
                <p className="text-sm text-muted-foreground">
                  Checkout fields, attendee questions, and promo codes appear
                  when registration requires tickets or free sign-up.
                </p>
              ) : (
                <InternalEventModuleDisabledState
                  title="Checkout settings"
                  description="Registration checkout is not configured for this event."
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

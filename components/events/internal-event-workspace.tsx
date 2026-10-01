"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Header } from "@/components/layout/header"
import { FacilityEventRequestDrawer } from "@/components/events/facility-event-request-drawer"
import { InternalEventCardActions } from "@/components/events/internal-event-card-actions"
import { InternalEventFeaturesSettings } from "@/components/events/internal-event-features-settings"
import { InternalEventGeneralSettings } from "@/components/events/internal-event-general-settings"
import { InternalEventMetaSettings } from "@/components/events/internal-event-meta-settings"
import { EventReportsPanel } from "@/components/events/event-reports-panel"
import { InternalEventModuleSetupPanel } from "@/components/events/internal-event-module-setup-panel"
import { InternalEventModuleDisabledState } from "@/components/events/internal-event-participations-panel"
import { InternalEventAttendeesTab } from "@/components/events/internal-event-attendees-tab"
import {
  InternalEventOverviewDashboard,
  InternalEventOverviewKpis,
} from "@/components/events/internal-event-overview-dashboard"
import { EventPlanningPanel } from "@/components/events/event-planning-panel"
import { EventChildcarePanel } from "@/components/events/event-childcare-panel"
import { EventVolunteersPanel } from "@/components/events/event-volunteers-panel"
import {
  getEventTaskDefinitionsFromRequirements,
  getEventTaskNamesFromRequirements,
  InternalEventStaffAssignments,
} from "@/components/events/internal-event-staff-tab"
import { InternalEventVendorsTab } from "@/components/events/internal-event-vendors-tab"
import { InternalEventStatusSelect } from "@/components/events/internal-event-status-select"
import { CampaignSponsorsTab } from "@/components/donations/campaign-sponsors-tab"
import { EventTicketingWorkspace } from "@/components/events/event-ticketing-workspace"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  parseEventTicketingPanelSection,
  type EventTicketingPanelSection,
} from "@/lib/events/event-management-section-path"
import type { EventOverviewSummary } from "@/lib/events/event-overview-metrics"
import type { EventExpense } from "@/lib/events/event-expense-types"
import type {
  EventCampaignOption,
  LinkedCampaignSummary,
} from "@/lib/events/event-finance-types"
import {
  getVisibleWorkspaceTabs,
  parseEventSettingsSection,
  resolveAttendanceMode,
  resolveEventWorkspaceFeatures,
  resolveWorkspaceTabId,
  type EventSettingsSection,
  type EventWorkspaceTabId,
} from "@/lib/events/event-workspace-features"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"
import type { EventAttendeeListItem, TicketOrderListItem } from "@/lib/tickets/ticket-order-queries"
import type { EventStaffCandidate } from "@/lib/events/event-staff-assignment-queries"
import type { EventTicketType } from "@/lib/tickets/ticket-types"
import type { ServiceParticipationWithContact } from "@/lib/service-participations/service-participation-types"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"
import type { VendorHubLinkForInternalEvent } from "@/lib/vendor-hub/vendor-hub-internal-event-queries"
import type { EventDocument } from "@/lib/events/event-document-types"
import type { InternalEventCreateFormOptions } from "@/lib/events/internal-event-form-options"
import {
  buildEventManagementEventsHref,
  DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS,
} from "@/lib/events/event-management-events-filters"
import { InternalEventDocumentsCard } from "@/components/events/internal-event-documents-card"
import { STAFF_MAIN_CONTENT_STICKY_TOP_CLASS } from "@/lib/layout/staff-dashboard-chrome"
import { cn } from "@/lib/utils"

export function InternalEventWorkspace({
  event,
  canManage,
  canCheckIn = false,
  deleteBlockedReason = null,
  participations = [],
  ticketTypes = [],
  attendees = [],
  orders = [],
  ticketingSection = "settings",
  staffCandidates = [],
  coordinatorCandidates = [],
  coordinatorName = null,
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
  eventFormOptions = null,
  featureHints,
}: {
  event: InternalEventWithRelations
  canManage: boolean
  canCheckIn?: boolean
  deleteBlockedReason?: string | null
  participations?: ServiceParticipationWithContact[]
  ticketTypes?: EventTicketType[]
  attendees?: EventAttendeeListItem[]
  orders?: TicketOrderListItem[]
  ticketingSection?: EventTicketingPanelSection
  staffCandidates?: EventStaffCandidate[]
  coordinatorCandidates?: Array<{ id: string; full_name: string }>
  coordinatorName?: string | null
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
  eventFormOptions?: InternalEventCreateFormOptions | null
  featureHints?: { hasPlanningQuote?: boolean; hasSponsors?: boolean }
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [editOpen, setEditOpen] = useState(false)
  const tabParam = searchParams.get("tab")
  const resolvedFromUrl = resolveWorkspaceTabId(tabParam)

  const features = resolveEventWorkspaceFeatures({ ...event, ...featureHints })
  const attendanceMode = resolveAttendanceMode(event)
  const hasPaidStaff = participations.some(
    (row) => row.participation_type === "staff" && row.status !== "cancelled"
  )
  const hasFinancialActivity =
    overview.finance.ticketRevenueCents > 0 ||
    overview.finance.expenseCents > 0 ||
    expenses.length > 0

  const visibleTabs = getVisibleWorkspaceTabs({
    features,
    attendanceMode,
    hasAttendees: attendees.length > 0,
    hasStaffAssignments: hasPaidStaff,
    needsVolunteers: event.requires_volunteers === true,
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
  const staffTasks = getEventTaskNamesFromRequirements(event.service_requirements)
  const staffTaskDefinitions = getEventTaskDefinitionsFromRequirements(
    event.service_requirements
  )
  const requestedSettingsSection = parseEventSettingsSection(
    searchParams.get("section")
  )
  const settingsSection: EventSettingsSection =
    requestedSettingsSection === "general" ? "general" : "features"

  const settingsSections: Array<{ id: EventSettingsSection; label: string }> = [
    { id: "general", label: "General" },
    { id: "features", label: "Features" },
  ]

  function replaceWorkspaceQuery(next: {
    tab: EventWorkspaceTabId
    section?: EventSettingsSection | EventTicketingPanelSection
  }) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", next.tab)
    if (next.tab === "settings" && next.section && next.section !== "general") {
      params.set("section", next.section)
    } else if (next.tab === "ticketing" && next.section && next.section !== "settings") {
      params.set("section", next.section)
    } else {
      params.delete("section")
    }
    const nextHref = `/event-management/${event.id}?${params.toString()}`
    const currentHref = `/event-management/${event.id}?${searchParams.toString()}`
    if (nextHref === currentHref) return
    router.replace(nextHref, { scroll: false })
  }

  const ticketingSections: Array<{ id: EventTicketingPanelSection; label: string }> = [
    { id: "settings", label: "Settings" },
    { id: "orders", label: "Orders" },
    { id: "check-in", label: "Check-in" },
  ]
  const activeTicketingSection = parseEventTicketingPanelSection(
    activeTab === "ticketing" ? searchParams.get("section") ?? ticketingSection : "settings"
  )

  function handleTabChange(value: string) {
    const nextTab = resolveWorkspaceTabId(value)
    if (!nextTab) return
    if (!visibleTabs.some((tab) => tab.value === nextTab)) return
    // Radix can emit onValueChange for the already-selected tab after RSC
    // refresh. Replacing the same URL retriggers the refresh and loops.
    if (nextTab === activeTab) return
    replaceWorkspaceQuery({
      tab: nextTab,
      section: nextTab === "settings" ? "general" : nextTab === "ticketing" ? "settings" : undefined,
    })
  }

  function handleTicketingSectionChange(section: EventTicketingPanelSection) {
    if (activeTab === "ticketing" && section === activeTicketingSection) return
    replaceWorkspaceQuery({ tab: "ticketing", section })
  }

  function handleSettingsSectionChange(section: EventSettingsSection) {
    if (activeTab === "settings" && section === settingsSection) return
    replaceWorkspaceQuery({ tab: "settings", section })
  }

  return (
    <>
      <Header title="Event Management" />

      <div
        className={cn(
          "flex flex-col gap-6 p-6",
          activeTab === "attendees" &&
            "h-[calc(100vh-11.75rem)] min-h-0 overflow-hidden"
        )}
      >
        <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Event workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {canManage && eventFormOptions ? (
                <button
                  type="button"
                  className="text-left text-primary hover:underline"
                  onClick={() => setEditOpen(true)}
                >
                  {event.name}
                </button>
              ) : (
                event.name
              )}
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

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className={cn(
            "gap-4",
            activeTab === "attendees" && "flex min-h-0 flex-1 flex-col"
          )}
        >
          <div
            className={cn(
              "sticky z-40 -mx-6 min-w-0 shrink-0 space-y-4 border-b border-border bg-background px-6 pb-4 pt-1",
              STAFF_MAIN_CONTENT_STICKY_TOP_CLASS
            )}
          >
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
              {visibleTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {activeTab === "overview" ? (
              <InternalEventOverviewKpis overview={overview} />
            ) : null}
            {activeTab === "ticketing" ? (
              <nav
                aria-label="Ticketing"
                className="flex flex-wrap gap-1 border-b border-border pb-px"
              >
                {ticketingSections.map((section) => {
                  const isActive = section.id === activeTicketingSection
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => handleTicketingSectionChange(section.id)}
                      className={cn(
                        "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                      )}
                    >
                      {section.label}
                    </button>
                  )
                })}
              </nav>
            ) : null}
            {activeTab === "settings" ? (
              <nav
                aria-label="Event settings"
                className="flex flex-wrap gap-1 border-b border-border pb-px"
              >
                {settingsSections.map((section) => {
                  const isActive = section.id === settingsSection
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => handleSettingsSectionChange(section.id)}
                      className={cn(
                        "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                      )}
                    >
                      {section.label}
                    </button>
                  )
                })}
              </nav>
            ) : null}
          </div>

          <TabsContent value="overview" className="mt-0">
            <InternalEventOverviewDashboard
              overview={overview}
              canManage={canManage}
              eventId={event.id}
              coordinatorName={coordinatorName}
              onNavigateTab={handleTabChange}
            />
          </TabsContent>

          <TabsContent value="plan" className="mt-0">
            <EventPlanningPanel eventId={event.id} canManage={canManage} />
          </TabsContent>

          <TabsContent value="ticketing" className="mt-0">
            <EventTicketingWorkspace
              eventId={event.id}
              eventName={event.name}
              section={activeTicketingSection}
              canManage={canManage}
              canCheckIn={canCheckIn}
              features={features}
              ticketTypes={ticketTypes}
              ticketingConfig={event.ticketing_config}
              requiresTicketing={event.requires_ticketing}
              orders={orders}
              orderEvent={{
                id: event.id,
                name: event.name,
                startAt: event.start_at ?? null,
                endAt: event.end_at ?? null,
              }}
              attendees={attendees}
            />
          </TabsContent>

          <TabsContent
            value="attendees"
            className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden"
          >
              <InternalEventAttendeesTab
                eventId={event.id}
                attendees={attendees}
                ticketTypes={ticketTypes}
                canManage={canManage}
                canCheckIn={canCheckIn || canManage}
                waitlistEnabled={features.waitlist}
              />
          </TabsContent>

          <TabsContent value="staff" className="mt-0">
            <InternalEventStaffAssignments
              eventId={event.id}
              tasks={staffTasks}
              taskDefinitions={staffTaskDefinitions}
              participations={participations}
              candidates={staffCandidates}
              canManage={canManage}
              showVolunteers={false}
            />
          </TabsContent>

          <TabsContent value="volunteers" className="mt-0">
            <EventVolunteersPanel
              event={event}
              participations={participations}
              canManage={canManage}
            />
          </TabsContent>

          <TabsContent value="childcare" className="mt-0">
            <EventChildcarePanel
              event={event}
              participations={participations}
              canManage={canManage}
            />
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

          <TabsContent value="sponsors" className="mt-0">
            {linkedCampaignId ? (
              <CampaignSponsorsTab
                campaignId={linkedCampaignId}
                lockedEventId={event.id}
                canManage={canManage}
                onChanged={() => router.refresh()}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Link this event to a fundraising campaign before adding sponsors. The campaign
                still holds the payments.
              </p>
            )}
          </TabsContent>

          <TabsContent value="reports" className="mt-0">
            <EventReportsPanel
              eventId={event.id}
              canManage={canManage}
              expenses={expenses}
              ticketTypes={ticketTypes}
              attendees={attendees}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            {settingsSection === "general" ? (
              <InternalEventGeneralSettings
                event={event}
                canManage={canManage}
                organizationSlug={organizationSlug}
              />
            ) : null}

            {settingsSection === "features" ? (
              <div className="space-y-6">
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
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
      {canManage && eventFormOptions ? (
        <FacilityEventRequestDrawer
          open={editOpen}
          onOpenChange={setEditOpen}
          departments={eventFormOptions.departments}
          eventTypes={eventFormOptions.eventTypes}
          venues={eventFormOptions.venues}
          setupStyles={eventFormOptions.setupStyles}
          defaults={eventFormOptions.defaults}
          approvalRequired={eventFormOptions.approvalRequired}
          editEventId={event.id}
          spaceMode="select"
          onSubmitted={(_eventId, extras) => {
            setEditOpen(false)
            if (extras?.recurrenceChanged) {
              router.push(
                buildEventManagementEventsHref({
                  ...DEFAULT_EVENT_MANAGEMENT_EVENTS_FILTERS,
                  recurrence: extras.recurring ? "recurring" : "one_time",
                })
              )
              return
            }
            router.refresh()
          }}
        />
      ) : null}
    </>
  )
}

"use client"

import { useRouter, useSearchParams } from "next/navigation"

import { Header } from "@/components/layout/header"
import { InternalEventCardActions } from "@/components/events/internal-event-card-actions"
import { InternalEventChildcareTab } from "@/components/events/internal-event-childcare-tab"
import { InternalEventFeaturesSettings } from "@/components/events/internal-event-features-settings"
import { InternalEventGeneralSettings } from "@/components/events/internal-event-general-settings"
import { InternalEventMetaSettings } from "@/components/events/internal-event-meta-settings"
import { InternalEventServiceNeedsSettings } from "@/components/events/internal-event-service-needs-settings"
import { InternalEventFinanceTab } from "@/components/events/internal-event-finance-tab"
import { InternalEventModuleSetupPanel } from "@/components/events/internal-event-module-setup-panel"
import { InternalEventModuleDisabledState } from "@/components/events/internal-event-participations-panel"
import { InternalEventAttendeesTab } from "@/components/events/internal-event-attendees-tab"
import {
  InternalEventOverviewDashboard,
  InternalEventOverviewKpis,
} from "@/components/events/internal-event-overview-dashboard"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { buildEventRecentOrders } from "@/lib/events/event-recent-activity"
import type { EventOverviewSummary } from "@/lib/events/event-overview-metrics"
import type { EventExpense } from "@/lib/events/event-expense-types"
import type {
  EventCampaignOption,
  LinkedCampaignSummary,
} from "@/lib/events/event-finance-types"
import {
  getVisibleWorkspaceTabs,
  isLegacyTicketsTab,
  parseEventSettingsSection,
  resolveAttendanceMode,
  resolveEventWorkspaceFeatures,
  resolveWorkspaceTabId,
  type EventSettingsSection,
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
  const showCheckoutSettings =
    features.registration && attendanceMode !== "open_public"
  const requestedSettingsSection = isLegacyTicketsTab(tabParam)
    ? "tickets"
    : parseEventSettingsSection(searchParams.get("section"))
  const settingsSection: EventSettingsSection =
    requestedSettingsSection === "checkout" && !showCheckoutSettings
      ? "tickets"
      : requestedSettingsSection

  const settingsSections: Array<{ id: EventSettingsSection; label: string }> = [
    { id: "general", label: "General" },
    { id: "tickets", label: "Tickets" },
    { id: "features", label: "Features" },
    ...(showCheckoutSettings
      ? [{ id: "checkout" as const, label: "Checkout" }]
      : []),
  ]

  function replaceWorkspaceQuery(next: { tab: EventWorkspaceTabId; section?: EventSettingsSection }) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", next.tab)
    if (next.tab === "settings" && next.section && next.section !== "general") {
      params.set("section", next.section)
    } else {
      params.delete("section")
    }
    const nextHref = `/event-management/${event.id}?${params.toString()}`
    const currentHref = `/event-management/${event.id}?${searchParams.toString()}`
    if (nextHref === currentHref) return
    router.replace(nextHref, { scroll: false })
  }

  function handleTabChange(value: string) {
    if (isLegacyTicketsTab(value)) {
      replaceWorkspaceQuery({ tab: "settings", section: "tickets" })
      return
    }
    const nextTab = resolveWorkspaceTabId(value)
    if (!nextTab) return
    if (!visibleTabs.some((tab) => tab.value === nextTab)) return
    // Radix can emit onValueChange for the already-selected tab after RSC
    // refresh. Replacing the same URL retriggers the refresh and loops.
    if (nextTab === activeTab) return
    replaceWorkspaceQuery({
      tab: nextTab,
      section: nextTab === "settings" ? "general" : undefined,
    })
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
              recentActivity={recentActivity}
              onNavigateTab={handleTabChange}
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
            {settingsSection === "general" ? (
              <InternalEventGeneralSettings
                event={event}
                canManage={canManage}
                organizationSlug={organizationSlug}
              />
            ) : null}

            {settingsSection === "tickets" ? (
              <InternalEventRegistrationWorkspace
                eventId={event.id}
                ticketTypes={ticketTypes}
                ticketingConfig={event.ticketing_config}
                requiresTicketing={event.requires_ticketing}
                canManage={canManage}
              />
            ) : null}

            {settingsSection === "features" ? (
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
              </div>
            ) : null}

            {settingsSection === "checkout" ? (
              showCheckoutSettings ? (
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
                  when this event has paid or free tickets.
                </p>
              ) : (
                <InternalEventModuleDisabledState
                  title="Checkout settings"
                  description="Registration checkout is not configured for this event."
                />
              )
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

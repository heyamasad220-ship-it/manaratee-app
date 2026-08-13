"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Calendar,
  MapPin,
  Building2,
  Tag,
  Heart,
  Baby,
  Store,
  Ticket,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { InternalEventCardActions } from "@/components/events/internal-event-card-actions"
import { InternalEventChildcareTab } from "@/components/events/internal-event-childcare-tab"
import { InternalEventCommunityCalendarCard } from "@/components/events/internal-event-community-calendar-card"
import { InternalEventFlyerCard } from "@/components/events/internal-event-flyer-card"
import { InternalEventModuleSetupPanel } from "@/components/events/internal-event-module-setup-panel"
import {
  InternalEventModuleDisabledState,
  InternalEventParticipationsPanel,
} from "@/components/events/internal-event-participations-panel"
import { InternalEventTicketingWorkspace } from "@/components/tickets/internal-event-ticketing-workspace"
import { InternalEventStatusSelect } from "@/components/events/internal-event-status-select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getInternalEventStatusLabel } from "@/lib/events/internal-event-status"
import { formatInternalEventLocation } from "@/lib/events/internal-event-location"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"
import type {
  ChildcareEventSummary,
  ChildcareRegistration,
} from "@/lib/child-care/childcare-registration-types"
import type { EventTicketType } from "@/lib/tickets/ticket-types"
import type { ServiceParticipationWithContact } from "@/lib/service-participations/service-participation-types"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"

const WORKSPACE_TABS = [
  { value: "overview", label: "Overview" },
  { value: "ticketing", label: "Ticketing" },
  { value: "volunteers", label: "Volunteers" },
  { value: "childcare", label: "Childcare" },
  { value: "vendors", label: "Vendors" },
] as const

type WorkspaceTab = (typeof WORKSPACE_TABS)[number]["value"]

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

function isWorkspaceTab(value: string | null): value is WorkspaceTab {
  return WORKSPACE_TABS.some((tab) => tab.value === value)
}

export function InternalEventWorkspace({
  event,
  canManage,
  deleteBlockedReason = null,
  participations = [],
  ticketTypes = [],
  childcareEvent = null,
  childcareRegistrations = [],
  vendorTypes = [],
  initialTab = "overview",
}: {
  event: InternalEventWithRelations
  canManage: boolean
  deleteBlockedReason?: string | null
  participations?: ServiceParticipationWithContact[]
  ticketTypes?: EventTicketType[]
  childcareEvent?: ChildcareEventSummary | null
  childcareRegistrations?: ChildcareRegistration[]
  vendorTypes?: VendorHubVendorType[]
  initialTab?: WorkspaceTab
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const activeTab = isWorkspaceTab(tabParam) ? tabParam : initialTab

  const departmentName = event.departments?.name || "Unknown department"
  const eventTypeName = event.event_types?.name || "Unknown type"

  const volunteerParticipations = participations.filter(
    (row) => row.participation_type === "volunteer"
  )
  const vendorParticipations = participations.filter((row) => row.participation_type === "vendor")
  const providerParticipations = participations.filter(
    (row) => row.participation_type === "childcare_provider"
  )

  function handleTabChange(value: string) {
    if (!isWorkspaceTab(value)) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    router.replace(`/event-management/${event.id}?${params.toString()}`, { scroll: false })
  }

  return (
    <>
      <Header title="Event Management" />

      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Event workspace</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
              <Badge variant="outline">{getInternalEventStatusLabel(event.status)}</Badge>
              {event.requires_volunteers ? (
                <Badge variant="secondary" className="gap-1">
                  <Heart className="h-3 w-3" />
                  Volunteers
                </Badge>
              ) : null}
              {event.requires_childcare ? (
                <Badge variant="secondary" className="gap-1">
                  <Baby className="h-3 w-3" />
                  Childcare
                </Badge>
              ) : null}
              {event.requires_vendors ? (
                <Badge variant="secondary" className="gap-1">
                  <Store className="h-3 w-3" />
                  Vendors
                </Badge>
              ) : null}
              {event.requires_ticketing ? (
                <Badge variant="secondary" className="gap-1">
                  <Ticket className="h-3 w-3" />
                  Ticketing
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {departmentName} · {eventTypeName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManage ? (
              <>
                <InternalEventStatusSelect eventId={event.id} status={event.status} />
                <InternalEventCardActions
                  eventId={event.id}
                  eventName={event.name}
                  deleteBlockedReason={deleteBlockedReason}
                  redirectAfterDelete="/event-management"
                />
              </>
            ) : null}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-4">
          <TabsList>
            {WORKSPACE_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Event details</CardTitle>
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
                        {formatDateTime(event.start_at)} – {formatDateTime(event.end_at)}
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

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {event.description || "No description provided."}
                    </p>
                  </CardContent>
                </Card>

                <InternalEventFlyerCard
                  eventId={event.id}
                  flyerUrl={event.flyer_url ?? null}
                  canManage={canManage}
                />

                <InternalEventCommunityCalendarCard
                  eventId={event.id}
                  communityCalendarStatus={event.community_calendar_status}
                  canManage={canManage}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ticketing" className="mt-0">
            {event.requires_ticketing ? (
              <InternalEventTicketingWorkspace
                eventId={event.id}
                eventName={event.name}
                ticketTypes={ticketTypes}
                ticketingConfig={event.ticketing_config}
                canManage={canManage}
              />
            ) : canManage ? (
              <InternalEventModuleSetupPanel
                event={event}
                module="ticketing"
                ticketTypes={ticketTypes}
                title="Ticketing"
                description="Enable ticketing to sell tickets, track orders, and manage capacity for this event."
              />
            ) : (
              <InternalEventModuleDisabledState
                title="Ticketing"
                description="Ticketing is not enabled for this event."
              />
            )}
          </TabsContent>

          <TabsContent value="volunteers" className="mt-0">
            {event.requires_volunteers ? (
              <div className="space-y-6">
                {canManage ? (
                  <InternalEventModuleSetupPanel
                    event={event}
                    module="volunteers"
                    title="Volunteer settings"
                    description="Update roles and capacity for volunteer sign-ups."
                  />
                ) : null}
                <InternalEventParticipationsPanel
                  participations={volunteerParticipations}
                  canManage={canManage}
                  participationType="volunteer"
                  title="Volunteers"
                  description="Volunteers who signed up for this event. Confirm or decline pending submissions."
                  emptyMessage="No volunteer sign-ups yet."
                />
              </div>
            ) : canManage ? (
              <InternalEventModuleSetupPanel
                event={event}
                module="volunteers"
                title="Volunteers"
                description="Enable volunteers to collect sign-ups and manage roles for this event."
              />
            ) : (
              <InternalEventModuleDisabledState
                title="Volunteers"
                description="Volunteers are not enabled for this event."
              />
            )}
          </TabsContent>

          <TabsContent value="childcare" className="mt-0">
            {event.requires_childcare ? (
              <div className="space-y-6">
                {canManage ? (
                  <InternalEventModuleSetupPanel
                    event={event}
                    module="childcare"
                    title="Childcare settings"
                    description="Update age groups, capacity, and registration deadline."
                  />
                ) : null}
                <InternalEventChildcareTab
                  event={event}
                  childcareEvent={childcareEvent}
                  registrations={childcareRegistrations}
                  providerParticipations={providerParticipations}
                  canManage={canManage}
                />
              </div>
            ) : canManage ? (
              <InternalEventModuleSetupPanel
                event={event}
                module="childcare"
                title="Childcare"
                description="Enable childcare to register children and assign providers for this event."
              />
            ) : (
              <InternalEventModuleDisabledState
                title="Childcare"
                description="Childcare is not enabled for this event."
              />
            )}
          </TabsContent>

          <TabsContent value="vendors" className="mt-0">
            {event.requires_vendors ? (
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
                <InternalEventParticipationsPanel
                  participations={vendorParticipations}
                  canManage={canManage}
                  participationType="vendor"
                  title="Vendors"
                  description="Vendors who applied to participate in this event."
                  emptyMessage="No vendor sign-ups yet."
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
        </Tabs>
      </div>
    </>
  )
}

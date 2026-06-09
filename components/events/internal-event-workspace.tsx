"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Calendar,
  MapPin,
  Pencil,
  Building2,
  Tag,
  Heart,
  Baby,
  Store,
  Ticket,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { InternalEventChildcareTab } from "@/components/events/internal-event-childcare-tab"
import {
  InternalEventModuleDisabledState,
  InternalEventParticipationsPanel,
} from "@/components/events/internal-event-participations-panel"
import { InternalEventTicketingPanel } from "@/components/events/internal-event-ticketing-panel"
import { InternalEventStatusSelect } from "@/components/events/internal-event-status-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getInternalEventStatusLabel } from "@/lib/events/internal-event-status"
import {
  formatChildcareAgeGroupLabel,
  parseServiceRequirements,
} from "@/lib/events/event-service-requirements"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"
import type {
  ChildcareEventSummary,
  ChildcareRegistration,
} from "@/lib/child-care/childcare-registration-types"
import type { EventTicketType } from "@/lib/tickets/ticket-types"
import type { ServiceParticipationWithContact } from "@/lib/service-participations/service-participation-types"

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
  participations = [],
  ticketTypes = [],
  childcareEvent = null,
  childcareRegistrations = [],
  initialTab = "overview",
}: {
  event: InternalEventWithRelations
  canManage: boolean
  participations?: ServiceParticipationWithContact[]
  ticketTypes?: EventTicketType[]
  childcareEvent?: ChildcareEventSummary | null
  childcareRegistrations?: ChildcareRegistration[]
  initialTab?: WorkspaceTab
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const activeTab = isWorkspaceTab(tabParam) ? tabParam : initialTab

  const departmentName = event.departments?.name || "Unknown department"
  const eventTypeName = event.event_types?.name || "Unknown type"
  const serviceConfig = parseServiceRequirements(event.service_requirements)
  const editHref = `/event-management/${event.id}/edit`

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
                <Button variant="outline" asChild>
                  <Link href={editHref}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </Button>
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
                        {event.venues?.name || event.location_label || "Not specified"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

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
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Modules</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Quick summary of ticketing, volunteers, childcare, and vendors for this event.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ModuleSummaryCard
                  label="Ticketing"
                  enabled={event.requires_ticketing === true}
                  summary={
                    event.requires_ticketing
                      ? `${ticketTypes.filter((type) => type.is_active).length} ticket type(s)`
                      : "Not enabled"
                  }
                  tab="ticketing"
                  onOpenTab={handleTabChange}
                />
                <ModuleSummaryCard
                  label="Volunteers"
                  enabled={event.requires_volunteers === true}
                  summary={
                    event.requires_volunteers
                      ? `${volunteerParticipations.length} sign-up(s)`
                      : "Not enabled"
                  }
                  tab="volunteers"
                  onOpenTab={handleTabChange}
                />
                <ModuleSummaryCard
                  label="Childcare"
                  enabled={event.requires_childcare === true}
                  summary={
                    event.requires_childcare
                      ? `${childcareRegistrations.length} registration(s)`
                      : "Not enabled"
                  }
                  tab="childcare"
                  onOpenTab={handleTabChange}
                />
                <ModuleSummaryCard
                  label="Vendors"
                  enabled={event.requires_vendors === true}
                  summary={
                    event.requires_vendors
                      ? `${vendorParticipations.length} sign-up(s)`
                      : "Not enabled"
                  }
                  tab="vendors"
                  onOpenTab={handleTabChange}
                />
              </CardContent>
            </Card>

            {(event.requires_volunteers ||
              event.requires_childcare ||
              event.requires_vendors) && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-base">Service requirements</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {event.requires_volunteers ? (
                    <div>
                      <p className="font-medium">Volunteers</p>
                      <p className="text-muted-foreground">
                        {serviceConfig.volunteers?.maxVolunteers
                          ? `Up to ${serviceConfig.volunteers.maxVolunteers} volunteers`
                          : "Volunteer sign-ups enabled"}
                        {serviceConfig.volunteers?.roles?.length
                          ? ` · ${serviceConfig.volunteers.roles.map((role) => `${role.name} (${role.slots})`).join(", ")}`
                          : ""}
                      </p>
                    </div>
                  ) : null}
                  {event.requires_childcare ? (
                    <div>
                      <p className="font-medium">Childcare</p>
                      <p className="text-muted-foreground">
                        {[
                          ...(serviceConfig.childcare?.ageGroups?.length
                            ? serviceConfig.childcare.ageGroups.map(
                                (group) =>
                                  `${formatChildcareAgeGroupLabel(group.ageRange)} (cap ${group.capacity})`
                              )
                            : [
                                serviceConfig.childcare?.ageRange
                                  ? `Ages ${serviceConfig.childcare.ageRange}`
                                  : null,
                                serviceConfig.childcare?.capacity
                                  ? `Capacity ${serviceConfig.childcare.capacity}`
                                  : null,
                              ]),
                          serviceConfig.childcare?.registrationDeadline
                            ? `Deadline ${serviceConfig.childcare.registrationDeadline}`
                            : null,
                        ]
                          .flat()
                          .filter(Boolean)
                          .join(" · ") || "Childcare enabled for this event"}
                      </p>
                    </div>
                  ) : null}
                  {event.requires_vendors ? (
                    <div>
                      <p className="font-medium">Vendors</p>
                      <p className="text-muted-foreground">
                        {[
                          serviceConfig.vendors?.maxVendors
                            ? `Up to ${serviceConfig.vendors.maxVendors} vendors`
                            : null,
                          serviceConfig.vendors?.applicationDeadline
                            ? `Apply by ${serviceConfig.vendors.applicationDeadline}`
                            : null,
                          serviceConfig.vendors?.fee != null
                            ? `Fee $${serviceConfig.vendors.fee}`
                            : null,
                          serviceConfig.vendors?.approvalRequired === false
                            ? "Auto-approve vendors"
                            : "Approval required",
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Vendor participation enabled"}
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="ticketing" className="mt-0">
            {event.requires_ticketing ? (
              <InternalEventTicketingPanel
                eventId={event.id}
                ticketTypes={ticketTypes}
                ticketingConfig={event.ticketing_config}
              />
            ) : (
              <InternalEventModuleDisabledState
                title="Ticketing"
                description="Enable ticketing to sell tickets, track orders, and manage capacity for this event."
                editHref={editHref}
              />
            )}
          </TabsContent>

          <TabsContent value="volunteers" className="mt-0">
            {event.requires_volunteers ? (
              <InternalEventParticipationsPanel
                participations={volunteerParticipations}
                canManage={canManage}
                participationType="volunteer"
                title="Volunteers"
                description="Volunteers who signed up for this event. Confirm or decline pending submissions."
                emptyMessage="No volunteer sign-ups yet."
              />
            ) : (
              <InternalEventModuleDisabledState
                title="Volunteers"
                description="Enable volunteers to collect sign-ups and manage roles for this event."
                editHref={editHref}
              />
            )}
          </TabsContent>

          <TabsContent value="childcare" className="mt-0">
            {event.requires_childcare ? (
              <InternalEventChildcareTab
                event={event}
                childcareEvent={childcareEvent}
                registrations={childcareRegistrations}
                providerParticipations={providerParticipations}
                canManage={canManage}
              />
            ) : (
              <InternalEventModuleDisabledState
                title="Childcare"
                description="Enable childcare to register children and assign providers for this event."
                editHref={editHref}
              />
            )}
          </TabsContent>

          <TabsContent value="vendors" className="mt-0">
            {event.requires_vendors ? (
              <InternalEventParticipationsPanel
                participations={vendorParticipations}
                canManage={canManage}
                participationType="vendor"
                title="Vendors"
                description="Vendors who applied to participate in this event."
                emptyMessage="No vendor sign-ups yet."
              />
            ) : (
              <InternalEventModuleDisabledState
                title="Vendors"
                description="Enable vendors to accept applications and manage booth participation."
                editHref={editHref}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

function ModuleSummaryCard({
  label,
  enabled,
  summary,
  tab,
  onOpenTab,
}: {
  label: string
  enabled: boolean
  summary: string
  tab: WorkspaceTab
  onOpenTab: (tab: WorkspaceTab) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenTab(tab)}
      className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40"
    >
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{enabled ? summary : "Not enabled"}</p>
    </button>
  )
}

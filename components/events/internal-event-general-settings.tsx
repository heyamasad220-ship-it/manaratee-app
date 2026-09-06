"use client"

import { useRouter } from "next/navigation"
import { Building2, Calendar, MapPin, Tag } from "lucide-react"

import { InternalEventCommunityCalendarCard } from "@/components/events/internal-event-community-calendar-card"
import { InternalEventDescriptionCard } from "@/components/events/internal-event-description-card"
import { InternalEventFlyerCard } from "@/components/events/internal-event-flyer-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatInternalEventLocation } from "@/lib/events/internal-event-location"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"

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

export function InternalEventGeneralSettings({
  event,
  canManage,
  organizationSlug,
}: {
  event: InternalEventWithRelations
  canManage: boolean
  organizationSlug?: string | null
}) {
  const router = useRouter()
  const departmentName = event.departments?.name || "Unknown department"
  const eventTypeName = event.event_types?.name || "Unknown type"

  return (
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
}

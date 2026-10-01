"use client"

import { useState, useTransition } from "react"
import { Download, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { InternalEventRegistrationWorkspace } from "@/components/events/internal-event-registration-workspace"
import { InternalEventSettingsWorkspace } from "@/components/events/internal-event-settings-workspace"
import { TicketCheckInScanner } from "@/components/tickets/ticket-check-in-scanner"
import { TicketingOrdersClient } from "@/components/tickets/ticketing-orders-client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { EventTicketingPanelSection } from "@/lib/events/event-management-section-path"
import { updateEventWorkspaceFeatures } from "@/lib/events/internal-event-actions"
import type { EventWorkspaceFeatures } from "@/lib/events/event-workspace-features"
import type { EventAttendeeListItem, TicketOrderListItem, TicketedEventOption } from "@/lib/tickets/ticket-order-queries"
import type { EventTicketType, EventTicketingConfig } from "@/lib/tickets/ticket-types"

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function downloadAttendeeCsv(eventId: string, attendees: EventAttendeeListItem[]) {
  const headers = [
    "attendee",
    "contact",
    "contact email",
    "contact phone",
    "type",
    "order",
    "status",
    "checked in",
  ]
  const lines = [headers.join(",")]
  for (const row of attendees) {
    lines.push(
      [
        row.attendeeName || "",
        row.purchaserName || "",
        row.purchaserEmail || "",
        row.purchaserPhone || "",
        row.ticketTypeName || "",
        row.orderNumber || "",
        row.status || "",
        row.checkedInAt || "",
      ]
        .map(csvEscape)
        .join(",")
    )
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `event-${eventId}-attendees.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function EventTicketingWorkspace({
  eventId,
  eventName,
  section,
  canManage,
  canCheckIn,
  features,
  ticketTypes,
  ticketingConfig,
  requiresTicketing,
  orders,
  orderEvent,
  attendees,
}: {
  eventId: string
  eventName: string
  section: EventTicketingPanelSection
  canManage: boolean
  canCheckIn: boolean
  features: EventWorkspaceFeatures
  ticketTypes: EventTicketType[]
  ticketingConfig?: EventTicketingConfig | null
  requiresTicketing?: boolean | null
  orders: TicketOrderListItem[]
  orderEvent: TicketedEventOption
  attendees: EventAttendeeListItem[]
}) {
  const router = useRouter()
  const [waitlist, setWaitlist] = useState(features.waitlist)
  const [waitlistError, setWaitlistError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleWaitlist(checked: boolean) {
    setWaitlist(checked)
    setWaitlistError(null)
    startTransition(async () => {
      const result = await updateEventWorkspaceFeatures({
        eventId,
        features: { ...features, waitlist: checked },
      })
      if (!result.success) {
        setWaitlist(features.waitlist)
        setWaitlistError(result.error || "Could not update the waitlist.")
        return
      }
      router.refresh()
    })
  }

  if (section === "orders") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {attendees.length.toLocaleString()} attendee
            {attendees.length === 1 ? "" : "s"} on this event.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => downloadAttendeeCsv(eventId, attendees)}
            disabled={attendees.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export attendees
          </Button>
        </div>
        <TicketingOrdersClient
          orders={orders}
          events={[orderEvent]}
          initialEventFilter={eventId}
          lockedEventId={eventId}
          embedded
          canManage={canManage}
        />
      </div>
    )
  }

  if (section === "check-in") {
    if (canCheckIn || canManage) {
      return <TicketCheckInScanner eventId={eventId} onCheckedIn={() => router.refresh()} />
    }
    return (
      <p className="text-sm text-muted-foreground">
        Door check-in needs the check-in permission. Registration volunteers use this screen to
        look people up as they arrive.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <div>
          <Label htmlFor="ticket-waitlist" className="text-sm font-medium">
            Waitlist
          </Label>
          <p className="mt-1 text-sm text-muted-foreground">
            Allow waitlisting when ticket capacity is full.
          </p>
        </div>
        <Switch
          id="ticket-waitlist"
          checked={waitlist}
          onCheckedChange={handleWaitlist}
          disabled={!canManage || isPending}
        />
      </div>
      {waitlistError ? <p className="text-sm text-destructive">{waitlistError}</p> : null}
      {isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving waitlist…
        </p>
      ) : null}
      <InternalEventRegistrationWorkspace
        eventId={eventId}
        ticketTypes={ticketTypes}
        ticketingConfig={ticketingConfig}
        requiresTicketing={requiresTicketing === true}
        canManage={canManage}
      />
      <InternalEventSettingsWorkspace
        eventId={eventId}
        eventName={eventName}
        ticketTypes={ticketTypes}
        ticketingConfig={ticketingConfig}
        canManage={canManage}
      />
    </div>
  )
}

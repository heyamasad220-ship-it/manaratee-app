"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { CalendarDays, Loader2, MapPin } from "lucide-react"

import { CreateInternalEventButton } from "@/components/events/create-internal-event-button"
import { ModuleNotSubscribed } from "@/components/modules/module-not-subscribed"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  attachEventToCampaignAction,
  listAttachableCampaignEventsAction,
  listCampaignEventsAction,
  type CampaignAttachableEventOption,
  type CampaignEventListItem,
  type CampaignEventStats,
} from "@/lib/events/campaign-event-actions"
import { cn } from "@/lib/utils"

type CampaignEventsTabProps = {
  campaignId: string
  onStatsChange?: (stats: CampaignEventStats | null) => void
}

function formatDateTime(value: string | null) {
  if (!value) return "Date TBD"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function CampaignEventsTab({
  campaignId,
  onStatsChange,
}: CampaignEventsTabProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [linked, setLinked] = useState<CampaignEventListItem[]>([])
  const [attachable, setAttachable] = useState<CampaignAttachableEventOption[]>([])
  const [canAttach, setCanAttach] = useState(false)
  const [canCreate, setCanCreate] = useState(false)
  const [canOpenEvent, setCanOpenEvent] = useState(false)
  const [eventManagementEnabled, setEventManagementEnabled] = useState(true)
  const [attachOpen, setAttachOpen] = useState(false)
  const [attachQuery, setAttachQuery] = useState("")
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    void listCampaignEventsAction(campaignId).then((result) => {
      if (!result.success) {
        setError(result.error)
        setLinked([])
        onStatsChange?.(null)
        setLoading(false)
        return
      }
      setLinked(result.linked)
      onStatsChange?.(result.stats)
      setCanAttach(result.canAttach)
      setCanCreate(result.canCreate)
      setCanOpenEvent(result.canOpenEvent)
      setEventManagementEnabled(result.eventManagementEnabled)
      setLoading(false)
    })
  }, [campaignId, onStatsChange])

  useEffect(() => {
    load()
  }, [load])

  const filteredAttachable = useMemo(() => {
    const query = attachQuery.trim().toLowerCase()
    if (!query) return attachable
    return attachable.filter((event) =>
      [event.name, event.departmentName, event.locationLabel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    )
  }, [attachable, attachQuery])

  function handleAttach() {
    if (!selectedEventId) return
    setError(null)
    startTransition(async () => {
      const result = await attachEventToCampaignAction({
        campaignId,
        eventId: selectedEventId,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setAttachOpen(false)
      setSelectedEventId(null)
      setAttachQuery("")
      load()
    })
  }

  function openAttachDialog() {
    setError(null)
    setAttachOpen(true)
    setAttachable([])
    void listAttachableCampaignEventsAction(campaignId).then((result) => {
      if (!result.success) {
        setError(result.error)
        return
      }
      setAttachable(result.events)
    })
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading event...
      </div>
    )
  }

  if (!eventManagementEnabled) {
    return <ModuleNotSubscribed moduleSlug="event-management" />
  }

  const showActions = linked.length === 0 && (canAttach || canCreate)

  return (
    <div className="space-y-4">
      {showActions ? (
        <div className="flex flex-wrap items-center gap-2">
          {canAttach ? (
            <Button variant="outline" size="sm" onClick={openAttachDialog}>
              Attach existing event
            </Button>
          ) : null}
          {canCreate ? (
            <CreateInternalEventButton
              campaignId={campaignId}
              onSubmitted={() => load()}
            />
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardContent className="p-0">
          {linked.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No event linked to this campaign yet. Attach an existing event or
              create a new one.
            </p>
          ) : (
            <ul>
              {linked.map((event) => {
                const href = `/event-management/${event.id}`
                const rowClassName =
                  "block rounded-md px-4 py-3 transition-colors hover:bg-muted/60"

                return (
                  <li key={event.id} className="border-b last:border-b-0">
                    {canOpenEvent ? (
                      <Link href={href} className={rowClassName}>
                        <EventListCopy event={event} />
                      </Link>
                    ) : (
                      <div className={cn(rowClassName, "hover:bg-transparent")}>
                        <EventListCopy event={event} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={attachOpen}
        onOpenChange={(open) => {
          setAttachOpen(open)
          if (!open) {
            setSelectedEventId(null)
            setAttachQuery("")
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Attach an existing event</DialogTitle>
            <DialogDescription>
              Choose an Event Management event to show on this campaign.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={attachQuery}
            onChange={(event) => setAttachQuery(event.target.value)}
            placeholder="Search events"
          />
          <div className="max-h-72 overflow-y-auto rounded-md border">
            {filteredAttachable.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No matching events. Create one if it does not exist yet.
              </p>
            ) : (
              <ul>
                {filteredAttachable.map((event) => {
                  const selected = selectedEventId === event.id
                  return (
                    <li key={event.id}>
                      <button
                        type="button"
                        className={`flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left last:border-b-0 ${
                          selected ? "bg-primary/5" : "hover:bg-muted/60"
                        }`}
                        onClick={() => setSelectedEventId(event.id)}
                      >
                        <span className="text-sm font-medium">{event.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(event.startAt)}
                          {event.departmentName ? ` · ${event.departmentName}` : ""}
                          {event.linkedCampaignId
                            ? " · Linked to another campaign"
                            : ""}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedEventId || isPending}
              onClick={handleAttach}
            >
              {isPending ? "Attaching..." : "Attach event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EventListCopy({ event }: { event: CampaignEventListItem }) {
  return (
    <div className="flex items-start gap-3">
      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-sm font-medium">{event.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(event.startAt)}
          {event.departmentName ? ` · ${event.departmentName}` : ""}
        </p>
        {event.locationLabel ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {event.locationLabel}
          </p>
        ) : null}
      </div>
    </div>
  )
}

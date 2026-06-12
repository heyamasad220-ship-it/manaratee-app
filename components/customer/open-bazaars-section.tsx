"use client"

import { useState, useTransition } from "react"
import { CalendarDays, Loader2, MapPin, Store } from "lucide-react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getAvailableBoothsForEvent,
  reserveBoothForEvent,
} from "@/lib/vendor-hub/vendor-booth-reservation-actions"
import type { ReservableBazaarEvent, ReservableBooth } from "@/lib/vendor-hub/vendor-participation-model"
import { cn } from "@/lib/utils"

function formatDate(value: string | null) {
  if (!value) return "Date not set"
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function ReserveBoothDialog({
  event,
  open,
  onOpenChange,
}: {
  event: ReservableBazaarEvent
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [booths, setBooths] = useState<ReservableBooth[]>([])
  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [loadingBooths, setLoadingBooths] = useState(false)

  const loadBooths = () => {
    setLoadingBooths(true)
    setError(null)
    startTransition(async () => {
      try {
        const available = await getAvailableBoothsForEvent(event.id)
        setBooths(available)
        if (available.length === 0) {
          setError("No booths are available for this bazaar right now.")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load booths.")
      } finally {
        setLoadingBooths(false)
      }
    })
  }

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setBooths([])
      setSelectedBoothId(null)
      setError(null)
      loadBooths()
    }
    onOpenChange(next)
  }

  const handleReserve = () => {
    if (!selectedBoothId) return
    setError(null)
    startTransition(async () => {
      try {
        await reserveBoothForEvent({ eventId: event.id, boothId: selectedBoothId })
        onOpenChange(false)
        router.refresh()
        router.push("/customer/bazaars")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not reserve booth.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reserve a booth</DialogTitle>
          <DialogDescription>
            {event.name} · {event.organizationName}. You are already an approved vendor — pick an
            available booth to hold your spot.
          </DialogDescription>
        </DialogHeader>

        {loadingBooths ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading available booths…
          </div>
        ) : booths.length > 0 ? (
          <div className="flex flex-col gap-2">
            {booths.map((booth) => {
              const selected = selectedBoothId === booth.id
              return (
                <button
                  key={booth.id}
                  type="button"
                  onClick={() => setSelectedBoothId(booth.id)}
                  className={cn(
                    "flex items-start justify-between rounded-lg border p-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "hover:border-muted-foreground/30"
                  )}
                >
                  <div>
                    <p className="font-medium">Booth {booth.number}</p>
                    {booth.boothTypeName ? (
                      <p className="text-sm text-muted-foreground">{booth.boothTypeName}</p>
                    ) : null}
                    {booth.location ? (
                      <p className="mt-1 text-xs text-muted-foreground">{booth.location}</p>
                    ) : null}
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(booth.feeAmount)}</span>
                </button>
              )
            })}
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleReserve} disabled={!selectedBoothId || isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reserving…
              </>
            ) : (
              "Reserve booth"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OpenBazaarCard({ event }: { event: ReservableBazaarEvent }) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{event.name}</p>
            <Badge variant="outline">Open for reservation</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{event.organizationName}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(event.eventDate)}
            </span>
            {event.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {event.location}
              </span>
            ) : null}
          </div>
        </div>
        <Button className="shrink-0" onClick={() => setDialogOpen(true)}>
          Reserve booth
        </Button>
      </div>
      <ReserveBoothDialog event={event} open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}

export function OpenBazaarsSection({ events }: { events: ReservableBazaarEvent[] }) {
  if (events.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Store className="h-4 w-4" />
          Open bazaars
        </CardTitle>
        <CardDescription>
          You are an approved vendor for these communities. Reserve a booth when a bazaar is
          published — no need to submit another application.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {events.map((event) => (
          <OpenBazaarCard key={event.id} event={event} />
        ))}
      </CardContent>
    </Card>
  )
}

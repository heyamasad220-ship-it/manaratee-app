"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Ban, Loader2, Trash2 } from "lucide-react"

import { CopyBazaarEventButton } from "@/components/vendor-hub/events/copy-bazaar-event-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cancelBazaarEvent } from "@/lib/vendor-hub/bazaar-event-lifecycle-actions"
import { deleteBazaarEvent } from "@/lib/vendor-hub/vendor-hub-event-actions"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import type { VendorHubEventWithInternal } from "@/lib/vendor-hub/vendor-hub-types"

export function BazaarEventQuickActions({
  event,
  deleteBlockedReason,
}: {
  event: VendorHubEventWithInternal
  deleteBlockedReason: string | null
}) {
  const router = useRouter()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isCancelled = event.status === "cancelled"
  const isCompleted = event.status === "completed"
  const canCancel = !isCancelled && !isCompleted
  const deleteBlocked = Boolean(deleteBlockedReason)

  function handleCancel() {
    setError(null)
    startTransition(async () => {
      try {
        await cancelBazaarEvent({
          eventId: event.id,
          reason: cancelReason,
          notifyVendors: true,
        })
        setCancelOpen(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not cancel event.")
      }
    })
  }

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      try {
        await deleteBazaarEvent(event.id)
        setDeleteOpen(false)
        router.push(VENDOR_HUB_ROUTES.events.list)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete event.")
      }
    })
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick actions</CardTitle>
          <CardDescription>Copy, cancel, or delete this bazaar event.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <CopyBazaarEventButton
            eventId={event.id}
            eventName={event.name}
            variant="outline"
            size="sm"
            className="w-full justify-start"
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start"
            disabled={!canCancel || isPending}
            onClick={() => {
              setError(null)
              setCancelOpen(true)
            }}
          >
            <Ban className="mr-2 h-4 w-4" />
            {isCancelled ? "Event cancelled" : isCompleted ? "Event completed" : "Cancel event"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start border-destructive/40 text-destructive hover:bg-destructive/10"
            disabled={deleteBlocked || isPending}
            onClick={() => {
              setError(null)
              setDeleteOpen(true)
            }}
            title={deleteBlockedReason ?? undefined}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete event
          </Button>

          {deleteBlocked ? (
            <p className="text-xs text-muted-foreground">{deleteBlockedReason}</p>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel bazaar</DialogTitle>
            <DialogDescription>
              This removes the event from open reservations and sends a cancellation message to
              vendors with booth assignments.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="quick-cancel-reason">Message to vendors (optional)</Label>
            <Textarea
              id="quick-cancel-reason"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              rows={4}
              placeholder="Explain the cancellation and any refund instructions…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={isPending}>
              Keep event
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling…
                </>
              ) : (
                "Cancel and notify vendors"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete bazaar event?</DialogTitle>
            <DialogDescription>
              This permanently deletes &ldquo;{event.name}&rdquo;. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isPending}>
              Keep event
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete event"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

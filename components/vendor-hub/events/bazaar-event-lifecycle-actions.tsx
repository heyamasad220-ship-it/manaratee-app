"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Ban, CheckCircle2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import {
  cancelBazaarEvent,
  closeBazaarEvent,
} from "@/lib/vendor-hub/bazaar-event-lifecycle-actions"
import type { VendorHubEventWithInternal } from "@/lib/vendor-hub/vendor-hub-types"

export function BazaarEventLifecycleActions({
  event,
}: {
  event: VendorHubEventWithInternal
}) {
  const router = useRouter()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isCompleted = event.status === "completed"
  const isCancelled = event.status === "cancelled"
  const isClosed = isCompleted || isCancelled

  const handleClose = () => {
    if (!window.confirm("Close this bazaar? It will be removed from open vendor reservations.")) {
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await closeBazaarEvent(event.id)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not close event.")
      }
    })
  }

  const handleCancel = () => {
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

  if (isClosed) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        This bazaar is marked as <span className="font-medium capitalize">{event.status}</span>.
        {isCompleted
          ? " Vendor evaluations are available on the Evaluations tab."
          : " Vendors were notified of the cancellation if messaging is enabled."}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <div>
          <p className="font-medium">Event lifecycle</p>
          <p className="text-sm text-muted-foreground">
            Close the bazaar after it ends, or cancel it and notify reserved vendors.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Close event
          </Button>
          <Button variant="destructive" onClick={() => setCancelOpen(true)} disabled={isPending}>
            <Ban className="mr-2 h-4 w-4" />
            Cancel event
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

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
            <Label htmlFor="cancel-reason">Message to vendors (optional)</Label>
            <Textarea
              id="cancel-reason"
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
              {isPending ? "Cancelling…" : "Cancel and notify vendors"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Copy, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { copyBazaarEvent } from "@/lib/vendor-hub/copy-bazaar-event-actions"

export function CopyBazaarEventDialog({
  sourceEventId,
  sourceEventName,
  open,
  onOpenChange,
}: {
  sourceEventId: string
  sourceEventName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [name, setName] = useState(`${sourceEventName} (Copy)`)
  const [eventDate, setEventDate] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleCopy = () => {
    setError(null)
    startTransition(async () => {
      try {
        const result = await copyBazaarEvent({
          sourceEventId,
          name,
          eventDate: eventDate || null,
          copyBoothSetup: true,
        })
        onOpenChange(false)
        router.push(`/vendor-hub/events/${result.id}`)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not copy event.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy bazaar event</DialogTitle>
          <DialogDescription>
            Duplicate booth types and booth inventory into a new draft event. Reservations,
            payments, and evaluations are not copied.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="copy-event-name">Event name</Label>
            <Input
              id="copy-event-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="copy-event-date">New event date (optional)</Label>
            <Input
              id="copy-event-date"
              type="date"
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleCopy} disabled={isPending || !name.trim()}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Copying…
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy event
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

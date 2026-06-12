"use client"

import { useState } from "react"
import { Copy } from "lucide-react"

import { CopyBazaarEventDialog } from "@/components/vendor-hub/events/copy-bazaar-event-dialog"
import { Button } from "@/components/ui/button"

export function CopyBazaarEventButton({
  eventId,
  eventName,
  variant = "outline",
  size = "default",
}: {
  eventId: string
  eventName: string
  variant?: "outline" | "ghost" | "default"
  size?: "default" | "sm"
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Copy className="mr-2 h-4 w-4" />
        Copy event
      </Button>
      <CopyBazaarEventDialog
        sourceEventId={eventId}
        sourceEventName={eventName}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

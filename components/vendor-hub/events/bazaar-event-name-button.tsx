"use client"

import { useState } from "react"

import { CreateBazaarEventDrawer } from "@/components/bazaar/create-bazaar-event-drawer"
import type { VendorHubEventWithInternal } from "@/lib/vendor-hub/vendor-hub-types"

export function BazaarEventNameButton({
  event,
}: {
  event: VendorHubEventWithInternal
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left text-2xl font-semibold tracking-tight text-primary hover:underline"
      >
        {event.name}
      </button>
      <CreateBazaarEventDrawer
        open={open}
        onOpenChange={setOpen}
        eventData={event}
      />
    </>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { FacilityEventRequestDrawer } from "@/components/events/facility-event-request-drawer"
import { Button } from "@/components/ui/button"
import type { RoomSetupStyle } from "@/lib/setup-styles/setup-style-types"
import type { InternalEventFormDefaults } from "@/lib/events/internal-event-form-defaults"

type CustomerStaffEventRequestClientProps = {
  departments: { id: string; name: string }[]
  eventTypes: { id: string; name: string }[]
  venues: { id: string; name: string }[]
  setupStyles: RoomSetupStyle[]
  defaults: InternalEventFormDefaults
  initialSlot: {
    venueId?: string
    startAt?: string
    endAt?: string
  }
  approvalRequired?: boolean
}

export function CustomerStaffEventRequestClient({
  departments,
  eventTypes,
  venues,
  setupStyles,
  defaults,
  initialSlot,
  approvalRequired = false,
}: CustomerStaffEventRequestClientProps) {
  const router = useRouter()
  const [open, setOpen] = useState(true)

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Request an event</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Center events use Facilities only to check space. Online and External
          Venue events skip Facilities and never wait for approval. Your name is
          recorded as the requester.
        </p>
      </div>
      {!open ? (
        <Button type="button" onClick={() => setOpen(true)}>
          Open request form
        </Button>
      ) : null}
      <FacilityEventRequestDrawer
        open={open}
        onOpenChange={setOpen}
        departments={departments}
        eventTypes={eventTypes}
        venues={venues}
        setupStyles={setupStyles}
        defaults={defaults}
        lockDepartment={Boolean(defaults.departmentId)}
        initialSlot={initialSlot}
        requestOrigin="member-staff"
        spaceMode="calendar-link"
        approvalRequired={approvalRequired}
        onSubmitted={() => {
          router.push("/customer/staff/events")
          router.refresh()
        }}
      />
    </div>
  )
}

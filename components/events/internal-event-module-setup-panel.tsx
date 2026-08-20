"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { EventServiceRequirementsFields } from "@/components/events/event-service-requirements-fields"
import { EventTicketingFields } from "@/components/events/event-ticketing-fields"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { updateInternalEventModules } from "@/lib/events/internal-event-actions"
import {
  serviceRequirementsFormFromEvent,
  type EventServiceRequirementsFormState,
} from "@/lib/events/event-service-requirements"
import {
  DEFAULT_EVENT_TICKETING_FORM,
  ticketingFormFromEvent,
  type EventTicketingFormState,
} from "@/lib/tickets/ticket-types"
import type { EventTicketType } from "@/lib/tickets/ticket-types"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"

type ServiceModule = "volunteers" | "childcare" | "vendors"

type InternalEventModuleSetupPanelProps = {
  event: InternalEventWithRelations
  module: ServiceModule | "ticketing"
  ticketTypes?: EventTicketType[]
  vendorTypes?: VendorHubVendorType[]
  title: string
  description: string
  /** Staff tab: task-oriented volunteer/staff settings. */
  staffMode?: boolean
}

function seedTicketingForm(
  event: InternalEventWithRelations,
  ticketTypes: EventTicketType[]
): EventTicketingFormState {
  if (event.requires_ticketing) {
    return ticketingFormFromEvent({
      requires_ticketing: true,
      ticketing_config: event.ticketing_config,
      ticketTypes,
    })
  }
  return {
    ...DEFAULT_EVENT_TICKETING_FORM,
    requiresTicketing: false,
    ticketTypes: [],
  }
}

export function InternalEventModuleSetupPanel({
  event,
  module,
  ticketTypes = [],
  vendorTypes = [],
  title,
  description,
  staffMode = false,
}: InternalEventModuleSetupPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [serviceForm, setServiceForm] = useState<EventServiceRequirementsFormState | null>(
    () => (module === "ticketing" ? null : serviceRequirementsFormFromEvent(event))
  )
  const [ticketingForm, setTicketingForm] = useState<EventTicketingFormState | null>(() =>
    module === "ticketing" ? seedTicketingForm(event, ticketTypes) : null
  )

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateInternalEventModules({
        eventId: event.id,
        serviceForm: serviceForm || undefined,
        ticketingForm: ticketingForm || undefined,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {module === "ticketing" && ticketingForm ? (
          <EventTicketingFields value={ticketingForm} onChange={setTicketingForm} />
        ) : null}
        {module !== "ticketing" && serviceForm ? (
          <EventServiceRequirementsFields
            value={serviceForm}
            onChange={setServiceForm}
            vendorTypes={vendorTypes}
            visibleModules={[module]}
            hideHeader
            staffMode={staffMode}
          />
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { EventServiceRequirementsFields } from "@/components/events/event-service-requirements-fields"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  serviceRequirementsFormFromEvent,
  type EventServiceRequirementsFormState,
} from "@/lib/events/event-service-requirements"
import { updateInternalEventModules } from "@/lib/events/internal-event-actions"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"

export function InternalEventServiceNeedsSettings({
  event,
  vendorTypes = [],
  canManage = true,
  canManageVendorTypes = false,
}: {
  event: InternalEventWithRelations
  vendorTypes?: VendorHubVendorType[]
  canManage?: boolean
  canManageVendorTypes?: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState<EventServiceRequirementsFormState>(() =>
    serviceRequirementsFormFromEvent(event)
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    setSaved(false)

    startTransition(async () => {
      const result = await updateInternalEventModules({
        eventId: event.id,
        serviceForm: form,
      })
      if (!result.success) {
        setError(result.error || "Could not save service needs.")
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Service needs</CardTitle>
        <p className="text-sm text-muted-foreground">
          When this event is active, eligible volunteers, childcare providers, and
          vendors can sign up from the customer Opportunities page. Parent childcare
          registration is also enabled when childcare is on.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {saved ? (
          <p className="text-sm text-green-700">Service needs saved.</p>
        ) : null}
        <EventServiceRequirementsFields
          value={form}
          onChange={(next) => {
            setSaved(false)
            setForm(next)
          }}
          vendorTypes={vendorTypes}
          canManageVendorTypes={canManage && canManageVendorTypes}
        />
        {canManage ? (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save service needs"
              )}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

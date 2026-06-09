"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  approveInternalEventRequest,
  declineInternalEventRequest,
} from "@/lib/events/internal-event-actions"
import { getInternalEventStatusLabel } from "@/lib/events/internal-event-status"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"
import { formatVenueRentalTimeRange } from "@/lib/bookings/venue-rental-format"

type InternalEventRequestsQueueProps = {
  requests: InternalEventWithRelations[]
  canManage: boolean
}

export function InternalEventRequestsQueue({
  requests,
  canManage,
}: InternalEventRequestsQueueProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [declineReasonById, setDeclineReasonById] = useState<Record<string, string>>({})

  function runAction(action: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try {
        await action()
        router.refresh()
      } catch (actionError) {
        setError(
          actionError instanceof Error ? actionError.message : "Action failed."
        )
      }
    })
  }

  if (!requests.length) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No pending internal event requests.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {requests.map((request) => (
        <Card key={request.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{request.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {request.departments?.name || "Department"} ·{" "}
              {request.event_types?.name || "Event type"} ·{" "}
              {getInternalEventStatusLabel(request.status)}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Venue: </span>
                {request.venues?.name || "Not assigned"}
              </p>
              <p>
                <span className="text-muted-foreground">Schedule: </span>
                {request.start_at && request.end_at
                  ? formatVenueRentalTimeRange(request.start_at, request.end_at)
                  : "TBD"}
              </p>
            </div>

            {request.description ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {request.description}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/event-management/${request.id}`}>View event</Link>
              </Button>
            </div>

            {canManage ? (
              <div className="space-y-3 rounded-lg border p-4">
                <Textarea
                  placeholder="Optional decline reason"
                  value={declineReasonById[request.id] || ""}
                  onChange={(event) =>
                    setDeclineReasonById((current) => ({
                      ...current,
                      [request.id]: event.target.value,
                    }))
                  }
                  rows={2}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      runAction(() => approveInternalEventRequest(request.id))
                    }
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      runAction(() =>
                        declineInternalEventRequest({
                          eventId: request.id,
                          declineReason: declineReasonById[request.id],
                        })
                      )
                    }
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Decline
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

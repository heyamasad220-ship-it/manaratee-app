"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { Loader2, Ticket } from "lucide-react"
import { useRouter } from "next/navigation"

import { EventTicketingFields } from "@/components/events/event-ticketing-fields"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { updateInternalEventModules } from "@/lib/events/internal-event-actions"
import {
  ATTENDANCE_MODE_OPTIONS,
  attendanceModeRequiresOfferings,
  resolveAttendanceMode,
  type EventAttendanceMode,
} from "@/lib/events/event-workspace-features"
import {
  formatTicketPrice,
  ticketingFormFromEvent,
  type EventTicketType,
  type EventTicketingConfig,
  type EventTicketingFormState,
} from "@/lib/tickets/ticket-types"

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function InternalEventRegistrationWorkspace({
  eventId,
  ticketTypes,
  ticketingConfig,
  requiresTicketing,
  canManage = true,
}: {
  eventId: string
  ticketTypes: EventTicketType[]
  ticketingConfig?: EventTicketingConfig | null
  requiresTicketing?: boolean
  canManage?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const activeTypes = ticketTypes.filter((type) => type.is_active)

  const [attendanceMode, setAttendanceMode] = useState<EventAttendanceMode>(() =>
    resolveAttendanceMode({
      requires_ticketing: requiresTicketing,
      ticketing_config: ticketingConfig,
    })
  )

  const [ticketingForm, setTicketingForm] = useState<EventTicketingFormState>(() =>
    ticketingFormFromEvent({
      requires_ticketing: true,
      ticketing_config: ticketingConfig,
      ticketTypes: activeTypes,
    })
  )

  useEffect(() => {
    setAttendanceMode(
      resolveAttendanceMode({
        requires_ticketing: requiresTicketing,
        ticketing_config: ticketingConfig,
      })
    )
    setTicketingForm(
      ticketingFormFromEvent({
        requires_ticketing: true,
        ticketing_config: ticketingConfig,
        ticketTypes: ticketTypes.filter((type) => type.is_active),
      })
    )
    setSaved(false)
  }, [eventId, ticketingConfig, ticketTypes, requiresTicketing])

  const showOfferings = attendanceModeRequiresOfferings(attendanceMode)

  function handleSave() {
    setSaveError(null)
    setSaved(false)
    startTransition(async () => {
      const result = showOfferings
        ? await updateInternalEventModules({
            eventId,
            attendanceMode,
            ticketingForm: {
              ...ticketingForm,
              requiresTicketing: true,
            },
          })
        : await updateInternalEventModules({
            eventId,
            attendanceMode,
            ticketingForm: {
              ...ticketingForm,
              requiresTicketing: false,
              ticketTypes: [],
            },
          })

      if (!result.success) {
        setSaveError(result.error || "Could not save registration settings.")
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attendance method</CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose how people attend this event. This controls registration and
            ticket offerings.
          </p>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <RadioGroup
              value={attendanceMode}
              onValueChange={(value) => {
                setAttendanceMode(value as EventAttendanceMode)
                setSaved(false)
              }}
              className="grid gap-3"
            >
              {ATTENDANCE_MODE_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <RadioGroupItem
                    value={option.value}
                    id={`attendance-${option.value}`}
                    className="mt-1"
                  />
                  <Label
                    htmlFor={`attendance-${option.value}`}
                    className="flex-1 cursor-pointer space-y-1"
                  >
                    <div className="font-medium">{option.label}</div>
                    <p className="text-sm font-normal text-muted-foreground">
                      {option.description}
                    </p>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          ) : (
            <p className="text-sm">
              {
                ATTENDANCE_MODE_OPTIONS.find((o) => o.value === attendanceMode)
                  ?.label
              }
            </p>
          )}
        </CardContent>
      </Card>

      {!showOfferings ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estimated attendance</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No registration or checkout is required. You can track an estimated
            headcount on event settings later. Sales windows and ticket types
            stay hidden for open-public events.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Ticket className="h-4 w-4" />
                Registration offerings
              </CardTitle>
              {canManage ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Set sales dates and times, then add ticket or registration
                  types.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/event-management/ticketing/orders?event=${eventId}`}>
                  View orders
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {canManage ? (
              <>
                <EventTicketingFields
                  value={ticketingForm}
                  onChange={(next) => {
                    setTicketingForm({ ...next, requiresTicketing: true })
                    setSaved(false)
                  }}
                  hideEnableSwitch
                />
                {activeTypes.some((type) => type.quantity_sold > 0) ? (
                  <p className="text-xs text-muted-foreground">
                    Sold counts:{" "}
                    {activeTypes
                      .filter((type) => type.quantity_sold > 0)
                      .map((type) => `${type.name} ${type.quantity_sold}`)
                      .join(" · ")}
                    . Types with sales cannot be fully deleted (they are
                    deactivated instead).
                  </p>
                ) : null}
              </>
            ) : activeTypes.length === 0 ? (
              <p className="text-muted-foreground">
                Registration is enabled but no offerings are configured yet.
              </p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="font-medium">Sales open</p>
                    <p className="text-muted-foreground">
                      {formatDateTime(ticketingConfig?.salesOpenAt)}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Sales close</p>
                    <p className="text-muted-foreground">
                      {formatDateTime(ticketingConfig?.salesCloseAt)}
                    </p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Sold</TableHead>
                        <TableHead>Capacity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeTypes.map((type) => (
                        <TableRow key={type.id}>
                          <TableCell>
                            <div className="font-medium">{type.name}</div>
                            {type.description ? (
                              <div className="text-xs text-muted-foreground">
                                {type.description}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            {formatTicketPrice(
                              type.price_cents,
                              ticketingConfig?.currency || "USD"
                            )}
                          </TableCell>
                          <TableCell>{type.quantity_sold}</TableCell>
                          <TableCell>
                            {type.quantity_total ?? "Unlimited"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {canManage ? (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
          {saveError ? (
            <p className="mr-auto text-sm text-destructive">{saveError}</p>
          ) : saved ? (
            <p className="mr-auto text-sm text-muted-foreground">Saved</p>
          ) : null}
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
        </div>
      ) : null}
    </div>
  )
}

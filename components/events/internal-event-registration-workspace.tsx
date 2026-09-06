"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { Loader2, Ticket } from "lucide-react"
import { useRouter } from "next/navigation"

import { EventTicketingFields } from "@/components/events/event-ticketing-fields"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DatePickerInput } from "@/components/ui/date-picker-input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TimeInput } from "@/components/ui/time-input"
import { updateInternalEventModules } from "@/lib/events/internal-event-actions"
import {
  ATTENDANCE_MODE_OPTIONS,
  resolveAttendanceMode,
  toAttendancePickerMode,
  type EventAttendancePickerMode,
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

function splitDatetimeLocal(value: string) {
  if (!value) return { date: "", time: "" }
  const [datePart, timePart = ""] = value.split("T")
  return {
    date: datePart || "",
    time: timePart.slice(0, 5),
  }
}

function joinDatetimeLocal(date: string, time: string) {
  if (!date) return ""
  return `${date}T${time || "12:00"}`
}

function todayLocalDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function roundTimeToStep(time: string, stepMinutes: number) {
  if (!time) return ""
  const [hoursPart, minutesPart] = time.split(":")
  const hours = Number.parseInt(hoursPart, 10)
  const minutes = Number.parseInt(minutesPart, 10)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time
  const rounded = Math.round(minutes / stepMinutes) * stepMinutes
  if (rounded >= 60) {
    return `${String((hours + 1) % 24).padStart(2, "0")}:00`
  }
  return `${String(hours).padStart(2, "0")}:${String(rounded).padStart(2, "0")}`
}

function applyAttendancePricing(
  form: EventTicketingFormState,
  mode: EventAttendancePickerMode
): EventTicketingFormState {
  return {
    ...form,
    ticketTypes: form.ticketTypes.map((row) =>
      mode === "free"
        ? { ...row, offeringKind: "complimentary" as const, price: "0" }
        : {
            ...row,
            offeringKind: row.offeringKind === "complimentary" ? "standard" : row.offeringKind,
          }
    ),
  }
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

  const [attendanceMode, setAttendanceMode] = useState<EventAttendancePickerMode>(() =>
    toAttendancePickerMode(
      resolveAttendanceMode({
        requires_ticketing: requiresTicketing,
        ticketing_config: ticketingConfig,
      })
    )
  )

  const [ticketingForm, setTicketingForm] = useState<EventTicketingFormState>(() =>
    ticketingFormFromEvent({
      requires_ticketing: true,
      ticketing_config: ticketingConfig,
      ticketTypes: activeTypes,
    })
  )

  useEffect(() => {
    const nextMode = toAttendancePickerMode(
      resolveAttendanceMode({
        requires_ticketing: requiresTicketing,
        ticketing_config: ticketingConfig,
      })
    )
    setAttendanceMode(nextMode)
    setTicketingForm(
      applyAttendancePricing(
        ticketingFormFromEvent({
          requires_ticketing: true,
          ticketing_config: ticketingConfig,
          ticketTypes: ticketTypes.filter((type) => type.is_active),
        }),
        nextMode
      )
    )
    setSaved(false)
  }, [eventId, ticketingConfig, ticketTypes, requiresTicketing])

  const pickerMode = toAttendancePickerMode(attendanceMode)
  const isFree = pickerMode === "free"

  function handleAttendanceChange(next: EventAttendancePickerMode) {
    setAttendanceMode(next)
    setTicketingForm((current) => applyAttendancePricing(current, next))
    setSaved(false)
  }

  function updateSalesPart(
    field: "salesOpenAt" | "salesCloseAt",
    part: "date" | "time",
    nextValue: string
  ) {
    const current = splitDatetimeLocal(ticketingForm[field])
    setSaved(false)
    if (part === "date") {
      setTicketingForm((form) => ({
        ...form,
        [field]: nextValue
          ? joinDatetimeLocal(nextValue, current.time || "12:00")
          : "",
      }))
      return
    }

    if (!current.date && !nextValue) {
      setTicketingForm((form) => ({ ...form, [field]: "" }))
      return
    }

    setTicketingForm((form) => ({
      ...form,
      [field]: joinDatetimeLocal(current.date || todayLocalDate(), nextValue),
    }))
  }

  function handleSave() {
    setSaveError(null)
    setSaved(false)
    startTransition(async () => {
      const pricedForm = applyAttendancePricing(ticketingForm, pickerMode)
      const result = await updateInternalEventModules({
        eventId,
        attendanceMode: pickerMode,
        ticketingForm: {
          ...pricedForm,
          requiresTicketing: true,
        },
      })

      if (!result.success) {
        setSaveError(result.error || "Could not save ticket settings.")
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  const salesOpen = splitDatetimeLocal(ticketingForm.salesOpenAt)
  const salesClose = splitDatetimeLocal(ticketingForm.salesCloseAt)

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          {canManage ? (
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
              <div className="w-full max-w-[160px] space-y-1.5">
                <Label htmlFor="attendance-method">Attendance method</Label>
                <Select
                  value={pickerMode}
                  onValueChange={(value) =>
                    handleAttendanceChange(value as EventAttendancePickerMode)
                  }
                >
                  <SelectTrigger id="attendance-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ATTENDANCE_MODE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Starts</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <DatePickerInput
                    id="sales-open-date"
                    value={salesOpen.date}
                    className="min-w-[180px]"
                    onChange={(next) =>
                      updateSalesPart("salesOpenAt", "date", next)
                    }
                  />
                  <TimeInput
                    id="sales-open-time"
                    value={
                      salesOpen.time ? roundTimeToStep(salesOpen.time, 30) : ""
                    }
                    minuteStep={30}
                    picker="list"
                    placeholder="Select time"
                    className="w-full sm:w-[140px]"
                    onChange={(next) =>
                      updateSalesPart("salesOpenAt", "time", next)
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Ends</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <DatePickerInput
                    id="sales-close-date"
                    value={salesClose.date}
                    min={salesOpen.date || undefined}
                    className="min-w-[180px]"
                    onChange={(next) =>
                      updateSalesPart("salesCloseAt", "date", next)
                    }
                  />
                  <TimeInput
                    id="sales-close-time"
                    value={
                      salesClose.time ? roundTimeToStep(salesClose.time, 30) : ""
                    }
                    minuteStep={30}
                    picker="list"
                    placeholder="Select time"
                    className="w-full sm:w-[140px]"
                    onChange={(next) =>
                      updateSalesPart("salesCloseAt", "time", next)
                    }
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm font-medium">Attendance method</p>
                <p className="text-sm text-muted-foreground">
                  {ATTENDANCE_MODE_OPTIONS.find((o) => o.value === pickerMode)
                    ?.label ?? pickerMode}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Starts</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(ticketingConfig?.salesOpenAt)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Ends</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(ticketingConfig?.salesCloseAt)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="h-4 w-4" />
            Ticket types
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/event-management/reports/orders?event=${eventId}`}>
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
                  setTicketingForm(
                    applyAttendancePricing(
                      { ...next, requiresTicketing: true },
                      pickerMode
                    )
                  )
                  setSaved(false)
                }}
                hideEnableSwitch
                hideSalesWindow
                hideKind
                lockFreePricing={isFree}
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
              No ticket types are configured yet.
            </p>
          ) : (
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
          )}
        </CardContent>
      </Card>

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

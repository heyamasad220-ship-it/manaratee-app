"use client"

import { useEffect, type KeyboardEvent } from "react"
import { Ticket, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { TimeInput } from "@/components/ui/time-input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  EventTicketTypeFormRow,
  EventTicketingFormState,
} from "@/lib/tickets/ticket-types"

type EventTicketingFieldsProps = {
  value: EventTicketingFormState
  onChange: (next: EventTicketingFormState) => void
  /** Hide the Enable switch when the parent already handles enable/save. */
  hideEnableSwitch?: boolean
  /** Hide sales open/close when the parent shows Starts / Ends. */
  hideSalesWindow?: boolean
  /** Hide Paid / Complimentary — mix complimentary seats with promo codes instead. */
  hideKind?: boolean
  /** Force $0 prices (free attendance). */
  lockFreePricing?: boolean
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

function createEmptyTicketType(free = false): EventTicketTypeFormRow {
  return {
    id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    price: free ? "0" : "",
    quantity: "",
    description: "",
    offeringKind: free ? "complimentary" : "standard",
    visibility: "public",
    minPerOrder: "1",
    maxPerOrder: "",
    salesStartAt: "",
    salesEndAt: "",
  }
}

export function EventTicketingFields({
  value,
  onChange,
  hideEnableSwitch = false,
  hideSalesWindow = false,
  hideKind = false,
  lockFreePricing = false,
}: EventTicketingFieldsProps) {
  const showDetails = hideEnableSwitch || value.requiresTicketing

  function update(partial: Partial<EventTicketingFormState>) {
    onChange({ ...value, ...partial })
  }

  useEffect(() => {
    if (!showDetails || value.ticketTypes.length > 0) return
    onChange({ ...value, ticketTypes: [createEmptyTicketType(lockFreePricing)] })
    // Only seed when details become visible with no rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot seed
  }, [showDetails, value.ticketTypes.length])

  function updateSalesPart(
    field: "salesOpenAt" | "salesCloseAt",
    part: "date" | "time",
    nextValue: string
  ) {
    const current = splitDatetimeLocal(value[field])
    if (part === "date") {
      update({
        [field]: nextValue
          ? joinDatetimeLocal(nextValue, current.time || "12:00")
          : "",
      })
      return
    }

    if (!current.date && !nextValue) {
      update({ [field]: "" })
      return
    }

    update({
      [field]: joinDatetimeLocal(current.date || todayLocalDate(), nextValue),
    })
  }

  function updateTicketType(
    id: string,
    field: keyof EventTicketTypeFormRow,
    fieldValue: string
  ) {
    update({
      ticketTypes: value.ticketTypes.map((row) => {
        if (row.id !== id) return row
        if (field === "offeringKind") {
          const offeringKind =
            fieldValue === "complimentary" ? "complimentary" : "standard"
          return {
            ...row,
            offeringKind,
            price: offeringKind === "complimentary" ? "0" : row.price,
          }
        }
        return { ...row, [field]: fieldValue }
      }),
    })
  }

  function removeTicketType(id: string) {
    const next = value.ticketTypes.filter((row) => row.id !== id)
    update({
      ticketTypes: next.length > 0 ? next : [createEmptyTicketType(lockFreePricing)],
    })
  }

  function handleQuantityCommit(
    rowId: string,
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key !== "Enter" && event.key !== "Tab") return
    if (event.key === "Tab" && event.shiftKey) return

    const index = value.ticketTypes.findIndex((row) => row.id === rowId)
    if (index < 0 || index !== value.ticketTypes.length - 1) return

    const row = value.ticketTypes[index]
    if (!row.name.trim() && !row.price.trim() && !row.quantity.trim()) return

    event.preventDefault()
    const next = createEmptyTicketType(lockFreePricing)
    update({ ticketTypes: [...value.ticketTypes, next] })

    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLInputElement>(
        `[data-ticket-name="${next.id}"]`
      )
      el?.focus()
    })
  }

  const salesOpen = splitDatetimeLocal(value.salesOpenAt)
  const salesClose = splitDatetimeLocal(value.salesCloseAt)

  return (
    <div
      className={
        hideEnableSwitch && hideSalesWindow
          ? "space-y-4"
          : "space-y-4 rounded-lg border p-4"
      }
    >
      {hideEnableSwitch ? null : (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Ticket className="h-4 w-4" />
              Ticketing
            </h3>
            <p className="text-xs text-muted-foreground">
              Sell tickets for dinners, seminars, galas, and other ticketed events.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="requires-ticketing" className="text-sm">
              Enable ticketing
            </Label>
            <Switch
              id="requires-ticketing"
              checked={value.requiresTicketing}
              onCheckedChange={(checked) =>
                update({
                  requiresTicketing: checked,
                  ticketTypes:
                    checked && value.ticketTypes.length === 0
                      ? [createEmptyTicketType(lockFreePricing)]
                      : value.ticketTypes,
                })
              }
            />
          </div>
        </div>
      )}

      {showDetails ? (
        <div className="space-y-4">
          {hideSalesWindow ? null : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sales-open-date">Sales open date</Label>
              <Input
                id="sales-open-date"
                type="date"
                value={salesOpen.date}
                onChange={(event) =>
                  updateSalesPart("salesOpenAt", "date", event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sales-open-time">Sales open time</Label>
              <TimeInput
                id="sales-open-time"
                value={
                  salesOpen.time ? roundTimeToStep(salesOpen.time, 30) : ""
                }
                minuteStep={30}
                placeholder="Select time"
                onChange={(next) =>
                  updateSalesPart("salesOpenAt", "time", next)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sales-close-date">Sales close date</Label>
              <Input
                id="sales-close-date"
                type="date"
                value={salesClose.date}
                min={salesOpen.date || undefined}
                onChange={(event) =>
                  updateSalesPart("salesCloseAt", "date", event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sales-close-time">Sales close time</Label>
              <TimeInput
                id="sales-close-time"
                value={
                  salesClose.time ? roundTimeToStep(salesClose.time, 30) : ""
                }
                minuteStep={30}
                placeholder="Select time"
                onChange={(next) =>
                  updateSalesPart("salesCloseAt", "time", next)
                }
              />
            </div>
          </div>
          )}

          <div className="space-y-3">
            {hideSalesWindow ? null : (
            <div>
              <p className="text-sm font-medium">Ticket types</p>
              <p className="text-xs text-muted-foreground">
                Use Complimentary for free/VIP types. Optional sale-from/until dates
                override the event window for that offering. Enter quantity and press
                Enter or Tab to add another row.
              </p>
            </div>
            )}

            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    {hideKind ? null : (
                      <TableHead className="w-[120px]">Kind</TableHead>
                    )}
                    <TableHead className="w-[120px]">Visibility</TableHead>
                    {lockFreePricing ? null : (
                      <TableHead className="w-[100px]">Price ($)</TableHead>
                    )}
                    <TableHead className="w-[90px]">Qty</TableHead>
                    <TableHead className="w-[70px]">Min</TableHead>
                    <TableHead className="w-[70px]">Max</TableHead>
                    <TableHead className="w-[120px]">Sale from</TableHead>
                    <TableHead className="w-[120px]">Sale until</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {value.ticketTypes.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Input
                          data-ticket-name={row.id}
                          value={row.name}
                          onChange={(event) =>
                            updateTicketType(row.id, "name", event.target.value)
                          }
                          placeholder="General admission"
                        />
                      </TableCell>
                      {hideKind ? null : (
                      <TableCell>
                        <Select
                          value={row.offeringKind || "standard"}
                          onValueChange={(next) =>
                            updateTicketType(row.id, "offeringKind", next)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Paid</SelectItem>
                            <SelectItem value="complimentary">
                              Complimentary
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      )}
                      <TableCell>
                        <Select
                          value={row.visibility || "public"}
                          onValueChange={(next) =>
                            updateTicketType(row.id, "visibility", next)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">Public</SelectItem>
                            <SelectItem value="unlisted">Unlisted</SelectItem>
                            <SelectItem value="private">Private</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      {lockFreePricing ? null : (
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.price}
                          disabled={row.offeringKind === "complimentary"}
                          onChange={(event) =>
                            updateTicketType(row.id, "price", event.target.value)
                          }
                          placeholder="25.00"
                        />
                      </TableCell>
                      )}
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={row.quantity}
                          onChange={(event) =>
                            updateTicketType(
                              row.id,
                              "quantity",
                              event.target.value
                            )
                          }
                          placeholder="∞"
                          onKeyDown={(event) =>
                            handleQuantityCommit(row.id, event)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={row.minPerOrder}
                          onChange={(event) =>
                            updateTicketType(row.id, "minPerOrder", event.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={row.maxPerOrder}
                          onChange={(event) =>
                            updateTicketType(row.id, "maxPerOrder", event.target.value)
                          }
                          placeholder="—"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={row.salesStartAt}
                          onChange={(event) =>
                            updateTicketType(row.id, "salesStartAt", event.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={row.salesEndAt}
                          min={row.salesStartAt || undefined}
                          onChange={(event) =>
                            updateTicketType(row.id, "salesEndAt", event.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTicketType(row.id)}
                          disabled={value.ticketTypes.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

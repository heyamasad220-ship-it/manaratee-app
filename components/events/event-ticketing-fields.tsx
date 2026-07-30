"use client"

import { Plus, Ticket, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { DateTimeInput } from "@/components/ui/datetime-input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { EventTicketingFormState } from "@/lib/tickets/ticket-types"

type EventTicketingFieldsProps = {
  value: EventTicketingFormState
  onChange: (next: EventTicketingFormState) => void
  /** Hide the Enable switch when the parent already handles enable/save. */
  hideEnableSwitch?: boolean
}

export function EventTicketingFields({
  value,
  onChange,
  hideEnableSwitch = false,
}: EventTicketingFieldsProps) {
  function update(partial: Partial<EventTicketingFormState>) {
    onChange({ ...value, ...partial })
  }

  function addTicketType() {
    update({
      ticketTypes: [
        ...value.ticketTypes,
        {
          id: `new-${Date.now()}`,
          name: "",
          price: "",
          quantity: "",
          description: "",
        },
      ],
    })
  }

  function updateTicketType(
    id: string,
    field: "name" | "price" | "quantity" | "description",
    fieldValue: string
  ) {
    update({
      ticketTypes: value.ticketTypes.map((row) =>
        row.id === id ? { ...row, [field]: fieldValue } : row
      ),
    })
  }

  function removeTicketType(id: string) {
    update({
      ticketTypes: value.ticketTypes.filter((row) => row.id !== id),
    })
  }

  const showDetails = hideEnableSwitch || value.requiresTicketing

  return (
    <div className="space-y-4 rounded-lg border p-4">
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
        {hideEnableSwitch ? null : (
          <div className="flex items-center gap-2">
            <Label htmlFor="requires-ticketing" className="text-sm">
              Enable ticketing
            </Label>
            <Switch
              id="requires-ticketing"
              checked={value.requiresTicketing}
              onCheckedChange={(checked) => update({ requiresTicketing: checked })}
            />
          </div>
        )}
      </div>

      {showDetails ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sales-open-at">Sales open</Label>
              <DateTimeInput
                id="sales-open-at"
                value={value.salesOpenAt}
                onChange={(next) => update({ salesOpenAt: next })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sales-close-at">Sales close</Label>
              <DateTimeInput
                id="sales-close-at"
                value={value.salesCloseAt}
                min={value.salesOpenAt || undefined}
                onChange={(next) => update({ salesCloseAt: next })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Ticket types</p>
                <p className="text-xs text-muted-foreground">
                  Define pricing and capacity for each ticket tier.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addTicketType}>
                <Plus className="mr-2 h-4 w-4" />
                Add ticket type
              </Button>
            </div>

            {value.ticketTypes.length === 0 ? (
              <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                No ticket types yet. Add at least one type before publishing sales.
              </p>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-[120px]">Price ($)</TableHead>
                      <TableHead className="w-[120px]">Quantity</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {value.ticketTypes.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Input
                            value={row.name}
                            onChange={(event) =>
                              updateTicketType(row.id, "name", event.target.value)
                            }
                            placeholder="General admission"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.price}
                            onChange={(event) =>
                              updateTicketType(row.id, "price", event.target.value)
                            }
                            placeholder="25.00"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={row.quantity}
                            onChange={(event) =>
                              updateTicketType(row.id, "quantity", event.target.value)
                            }
                            placeholder="Unlimited"
                          />
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={row.description}
                            onChange={(event) =>
                              updateTicketType(row.id, "description", event.target.value)
                            }
                            rows={2}
                            placeholder="Optional details"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTicketType(row.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

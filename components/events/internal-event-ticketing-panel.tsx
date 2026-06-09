import Link from "next/link"
import { Ticket } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"
import type { EventTicketType } from "@/lib/tickets/ticket-types"
import type { EventTicketingConfig } from "@/lib/tickets/ticket-types"

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

export function InternalEventTicketingPanel({
  eventId,
  ticketTypes,
  ticketingConfig,
}: {
  eventId: string
  ticketTypes: EventTicketType[]
  ticketingConfig?: EventTicketingConfig | null
}) {
  const activeTypes = ticketTypes.filter((type) => type.is_active)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Ticket className="h-4 w-4" />
          Ticketing
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/event-management/ticketing/orders?event=${eventId}`}>View orders</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/event-management/${eventId}/edit`}>Edit ticket types</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
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

        {activeTypes.length === 0 ? (
          <p className="text-muted-foreground">
            Ticketing is enabled but no ticket types are configured yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket type</TableHead>
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
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {formatTicketPrice(type.price_cents, ticketingConfig?.currency || "USD")}
                    </TableCell>
                    <TableCell>{type.quantity_sold}</TableCell>
                    <TableCell>{type.quantity_total ?? "Unlimited"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

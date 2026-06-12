"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Copy, Ticket } from "lucide-react"

import { AttendeeQuestionsEditor } from "@/components/tickets/attendee-questions-editor"
import { CheckoutFormFieldsEditor } from "@/components/tickets/checkout-form-fields-editor"
import { DiscountCodesPanel } from "@/components/tickets/discount-codes-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"
import type { EventTicketType, EventTicketingConfig } from "@/lib/tickets/ticket-types"
import {
  DEFAULT_ORG_CHECKOUT_FIELDS,
  getDefaultEventCheckoutConfig,
  getEventDiscountCodes,
} from "@/lib/tickets/ticketing-checkout-ui-types"

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

export function InternalEventTicketingWorkspace({
  eventId,
  eventName,
  ticketTypes,
  ticketingConfig,
  canManage = true,
}: {
  eventId: string
  eventName: string
  ticketTypes: EventTicketType[]
  ticketingConfig?: EventTicketingConfig | null
  canManage?: boolean
}) {
  const initialCheckout = useMemo(() => getDefaultEventCheckoutConfig(eventId), [eventId])
  const [useOrganizationDefault, setUseOrganizationDefault] = useState(
    initialCheckout.useOrganizationDefault
  )
  const [fields, setFields] = useState(initialCheckout.fields)
  const [attendeeQuestions, setAttendeeQuestions] = useState(
    initialCheckout.attendeeQuestions
  )

  const eventPromoCodes = useMemo(() => getEventDiscountCodes(eventId), [eventId])
  const activeTypes = ticketTypes.filter((type) => type.is_active)

  function handleUseOrgDefaultChange(checked: boolean) {
    setUseOrganizationDefault(checked)
    if (checked) {
      setFields(DEFAULT_ORG_CHECKOUT_FIELDS.map((field) => ({ ...field })))
    }
  }

  function copyFromOrganizationDefault() {
    setFields(DEFAULT_ORG_CHECKOUT_FIELDS.map((field) => ({ ...field })))
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="h-4 w-4" />
            Sales & ticket types
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/event-management/ticketing/orders?event=${eventId}`}>
                View orders
              </Link>
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
                        {formatTicketPrice(
                          type.price_cents,
                          ticketingConfig?.currency || "USD"
                        )}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checkout & questions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Control what buyers see at checkout for this event.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/20 p-4">
            <div>
              <Label htmlFor="use-org-default" className="text-sm font-medium">
                Use organization default checkout
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Inherit the default form from{" "}
                <Link
                  href="/event-management/ticketing/settings"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Ticketing settings
                </Link>
                .
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={
                  useOrganizationDefault
                    ? "bg-blue-100 text-blue-700"
                    : "bg-emerald-100 text-emerald-700"
                }
              >
                {useOrganizationDefault ? "Using default" : "Customized"}
              </Badge>
              <Switch
                id="use-org-default"
                checked={useOrganizationDefault}
                onCheckedChange={handleUseOrgDefaultChange}
                disabled={!canManage}
              />
            </div>
          </div>

          {!useOrganizationDefault ? (
            <>
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-medium">Checkout fields</h4>
                    <p className="text-sm text-muted-foreground">
                      Choose which buyer fields appear at checkout.
                    </p>
                  </div>
                  {canManage ? (
                    <Button variant="outline" size="sm" onClick={copyFromOrganizationDefault}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy from organization default
                    </Button>
                  ) : null}
                </div>
                <CheckoutFormFieldsEditor
                  fields={fields}
                  onChange={setFields}
                  showAddField={canManage}
                  compact
                />
              </div>

              <AttendeeQuestionsEditor
                questions={attendeeQuestions}
                onChange={setAttendeeQuestions}
              />

              {canManage ? (
                <div className="flex justify-end">
                  <Button>Save checkout settings</Button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              This event uses the organization default checkout form. Turn off the toggle above
              to customize fields and add attendee questions for this event.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <DiscountCodesPanel
            title="Event promo codes"
            description="Promo codes that work only for this event at checkout."
            codes={eventPromoCodes}
            scope="event"
            eventName={eventName}
          />
        </CardContent>
      </Card>
    </div>
  )
}

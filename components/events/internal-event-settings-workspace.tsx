"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { Copy, Loader2, Settings } from "lucide-react"
import { useRouter } from "next/navigation"

import { AttendeeQuestionsEditor } from "@/components/tickets/attendee-questions-editor"
import { CheckoutFormFieldsEditor } from "@/components/tickets/checkout-form-fields-editor"
import { DiscountCodesPanel } from "@/components/tickets/discount-codes-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { updateInternalEventModules } from "@/lib/events/internal-event-actions"
import type {
  EventTicketType,
  EventTicketingCommunications,
  EventTicketingConfig,
} from "@/lib/tickets/ticket-types"
import {
  DEFAULT_ORG_CHECKOUT_FIELDS,
  getEventCheckoutConfigFromTicketing,
  getEventDiscountCodes,
  type AttendeeQuestion,
  type CheckoutFormField,
  type EventCheckoutConfig,
} from "@/lib/tickets/ticketing-checkout-ui-types"
import { parseEventTicketingCommunications } from "@/lib/tickets/ticket-types"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

function checkoutFromConfig(
  eventId: string,
  ticketingConfig?: EventTicketingConfig | null
): EventCheckoutConfig {
  return getEventCheckoutConfigFromTicketing(eventId, {
    checkout: ticketingConfig?.checkout as EventCheckoutConfig | null | undefined,
  })
}

export function InternalEventSettingsWorkspace({
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
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const initialCheckout = useMemo(
    () => checkoutFromConfig(eventId, ticketingConfig),
    [eventId, ticketingConfig]
  )
  const [useOrganizationDefault, setUseOrganizationDefault] = useState(
    initialCheckout.useOrganizationDefault
  )
  const [fields, setFields] = useState<CheckoutFormField[]>(initialCheckout.fields)
  const [attendeeQuestions, setAttendeeQuestions] = useState<AttendeeQuestion[]>(
    initialCheckout.attendeeQuestions
  )
  const initialCommunications = useMemo(
    () => parseEventTicketingCommunications(ticketingConfig?.communications),
    [ticketingConfig]
  )
  const [confirmationSubject, setConfirmationSubject] = useState(
    initialCommunications.confirmationSubject || ""
  )
  const [confirmationMessage, setConfirmationMessage] = useState(
    initialCommunications.confirmationMessage || ""
  )
  const [reservationSubject, setReservationSubject] = useState(
    initialCommunications.reservationSubject || ""
  )
  const [reservationMessage, setReservationMessage] = useState(
    initialCommunications.reservationMessage || ""
  )

  const eventPromoCodes = useMemo(() => getEventDiscountCodes(eventId), [eventId])
  const activeTypes = ticketTypes.filter((type) => type.is_active)

  useEffect(() => {
    const checkout = checkoutFromConfig(eventId, ticketingConfig)
    setUseOrganizationDefault(checkout.useOrganizationDefault)
    setFields(checkout.fields)
    setAttendeeQuestions(checkout.attendeeQuestions)
    const communications = parseEventTicketingCommunications(
      ticketingConfig?.communications
    )
    setConfirmationSubject(communications.confirmationSubject || "")
    setConfirmationMessage(communications.confirmationMessage || "")
    setReservationSubject(communications.reservationSubject || "")
    setReservationMessage(communications.reservationMessage || "")
    setSaved(false)
  }, [eventId, ticketingConfig])

  function markDirty() {
    setSaved(false)
  }

  function handleUseOrgDefaultChange(checked: boolean) {
    setUseOrganizationDefault(checked)
    markDirty()
    if (checked) {
      setFields(DEFAULT_ORG_CHECKOUT_FIELDS.map((field) => ({ ...field })))
    }
  }

  function copyFromOrganizationDefault() {
    setFields(DEFAULT_ORG_CHECKOUT_FIELDS.map((field) => ({ ...field })))
    markDirty()
  }

  function handleSave() {
    setSaveError(null)
    setSaved(false)
    startTransition(async () => {
      const checkoutConfig: EventCheckoutConfig = {
        useOrganizationDefault,
        fields: useOrganizationDefault
          ? DEFAULT_ORG_CHECKOUT_FIELDS.map((field) => ({ ...field }))
          : fields,
        attendeeQuestions,
      }

      const communicationsConfig: EventTicketingCommunications = {
        confirmationSubject: confirmationSubject.trim() || null,
        confirmationMessage: confirmationMessage.trim() || null,
        reservationSubject: reservationSubject.trim() || null,
        reservationMessage: reservationMessage.trim() || null,
      }

      const result = await updateInternalEventModules({
        eventId,
        checkoutConfig,
        communicationsConfig,
      })
      if (!result.success) {
        setSaveError(result.error || "Could not save event settings.")
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
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            Checkout & questions
          </CardTitle>
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
                onChange={(next) => {
                  setFields(next)
                  markDirty()
                }}
                showAddField={canManage}
                compact
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This event uses the organization default buyer fields. Turn off the toggle above
              to customize name, email, phone, and other purchaser fields.
            </p>
          )}

          {canManage ? (
            <AttendeeQuestionsEditor
              questions={attendeeQuestions}
              onChange={(next) => {
                setAttendeeQuestions(next)
                markDirty()
              }}
              ticketTypes={activeTypes.map((row) => ({ id: row.id, name: row.name }))}
            />
          ) : attendeeQuestions.length > 0 ? (
            <div className="space-y-2">
              <h4 className="font-medium">Attendee questions</h4>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {attendeeQuestions.map((question) => (
                  <li key={question.id}>{question.question}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Communications</CardTitle>
          <p className="text-sm text-muted-foreground">
            Optional overrides for registration confirmation and pay-at-event
            reservation emails. Leave blank to use the default Manaratee copy.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="confirmation-subject">Confirmation subject</Label>
              <Input
                id="confirmation-subject"
                value={confirmationSubject}
                onChange={(event) => {
                  setConfirmationSubject(event.target.value)
                  markDirty()
                }}
                placeholder={`Your registration for ${eventName}`}
                disabled={!canManage}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reservation-subject">Reservation subject</Label>
              <Input
                id="reservation-subject"
                value={reservationSubject}
                onChange={(event) => {
                  setReservationSubject(event.target.value)
                  markDirty()
                }}
                placeholder={`Ticket reservation for ${eventName}`}
                disabled={!canManage}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmation-message">Confirmation extra message</Label>
            <Textarea
              id="confirmation-message"
              rows={3}
              value={confirmationMessage}
              onChange={(event) => {
                setConfirmationMessage(event.target.value)
                markDirty()
              }}
              placeholder="Optional note after the confirmation intro (parking, dress code, etc.)"
              disabled={!canManage}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reservation-message">Reservation extra message</Label>
            <Textarea
              id="reservation-message"
              rows={3}
              value={reservationMessage}
              onChange={(event) => {
                setReservationMessage(event.target.value)
                markDirty()
              }}
              placeholder="Optional note for pay-at-event holds"
              disabled={!canManage}
            />
          </div>
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

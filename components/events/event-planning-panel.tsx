"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  addEventPlanningQuoteAction,
  copyEventPlanningQuotesAction,
  deleteEventPlanningQuoteAction,
  getEventPlanningAction,
  listKidsProgramFamiliesAction,
  saveEventPlanningSheetAction,
  seedDinnerSignUpJobsAction,
  sendKidsProgramMessageAction,
  updateEventPlanningQuoteAction,
} from "@/lib/events/event-planning-actions"
import {
  centsToDollarInput,
  EVENT_PLANNING_KIND_LABELS,
  EVENT_PLANNING_KINDS,
  planningCostPerGuest,
  type EventPlanningKind,
  type EventPlanningPastEvent,
  type EventPlanningPlace,
  type EventPlanningQuote,
  type EventPlanningQuoteStatus,
  type EventPlanningSheet,
} from "@/lib/events/event-planning"

function money(cents: number | null) {
  if (cents == null) return "—"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

export function EventPlanningPanel({
  eventId,
  canManage,
}: {
  eventId: string
  canManage: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [places, setPlaces] = useState<EventPlanningPlace[]>([])
  const [quotes, setQuotes] = useState<EventPlanningQuote[]>([])
  const [sheet, setSheet] = useState<EventPlanningSheet | null>(null)
  const [pastEvents, setPastEvents] = useState<EventPlanningPastEvent[]>([])
  const [ticketTypes, setTicketTypes] = useState<Array<{ id: string; name: string }>>([])
  const [sourceEventId, setSourceEventId] = useState("")
  const [families, setFamilies] = useState<
    Array<{ name: string; email: string; phone: string; tickets: string[] }>
  >([])
  const [emailSubject, setEmailSubject] = useState("Kids program details")
  const [isPending, startTransition] = useTransition()

  function load() {
    setLoading(true)
    void getEventPlanningAction(eventId).then((result) => {
      setLoading(false)
      if (!result.success) {
        setError(result.error)
        return
      }
      setError(null)
      setPlaces(result.places)
      setQuotes(result.quotes)
      setSheet(result.sheet)
      setPastEvents(result.pastEvents)
      setTicketTypes(result.ticketTypes)
      if (result.sheet.kidsMessage) setEmailSubject("Kids program details")
    })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const chosen = useMemo(() => {
    const byKind = (kind: EventPlanningKind) =>
      quotes.find((quote) => quote.place.kind === kind && quote.status === "chosen") || null
    return {
      dinner: byKind("dinner_venue"),
      kids: byKind("kids_venue"),
      transport: byKind("transport"),
    }
  }, [quotes])

  const perGuest = sheet
    ? planningCostPerGuest({
        dinnerCents: chosen.dinner?.priceCents ?? null,
        kidsCents: chosen.kids?.priceCents ?? null,
        transportCents: chosen.transport?.priceCents ?? null,
        otherCents: sheet.otherCostCents,
        headcount: sheet.expectedHeadcount,
      })
    : null

  function refreshFamilies() {
    startTransition(async () => {
      const result = await listKidsProgramFamiliesAction(eventId)
      if (!result.success) {
        setError(result.error)
        return
      }
      setFamilies(result.families)
    })
  }

  if (loading || !sheet) {
    return <p className="text-sm text-muted-foreground">Loading plan…</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Start from a previous year</CardTitle>
          <p className="text-sm text-muted-foreground">
            Quoted venues and companies stay in the organization. Copying a past dinner
            puts them on this event with last year’s price as a reference.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label>Past event</Label>
            <Select value={sourceEventId} onValueChange={setSourceEventId}>
              <SelectTrigger>
                <SelectValue placeholder={pastEvents.length ? "Choose an event" : "No quoted events yet"} />
              </SelectTrigger>
              <SelectContent>
                {pastEvents.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            disabled={!canManage || !sourceEventId || isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await copyEventPlanningQuotesAction({
                  eventId,
                  sourceEventId,
                })
                if (!result.success) {
                  setError(result.error)
                  return
                }
                load()
              })
            }
          >
            Copy quotes
          </Button>
        </CardContent>
      </Card>

      {EVENT_PLANNING_KINDS.map((kind) => (
        <QuoteSection
          key={kind}
          kind={kind}
          eventId={eventId}
          canManage={canManage}
          places={places.filter((place) => place.kind === kind)}
          quotes={quotes.filter((quote) => quote.place.kind === kind)}
          onChanged={load}
          onError={setError}
        />
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cost per guest</CardTitle>
          <p className="text-sm text-muted-foreground">
            Uses the chosen dinner venue, kids venue, and transportation quotes, plus any other cost,
            divided by the expected general-admission headcount. Ticket prices are set on Ticketing.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="plan-headcount">Expected guests</Label>
              <Input
                id="plan-headcount"
                inputMode="numeric"
                value={sheet.expectedHeadcount ?? ""}
                disabled={!canManage}
                onChange={(event) =>
                  setSheet({
                    ...sheet,
                    expectedHeadcount: event.target.value
                      ? Number.parseInt(event.target.value, 10)
                      : null,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-other">Other costs ($)</Label>
              <Input
                id="plan-other"
                inputMode="decimal"
                value={centsToDollarInput(sheet.otherCostCents)}
                disabled={!canManage}
                onChange={(event) => {
                  const amount = Number.parseFloat(event.target.value)
                  setSheet({
                    ...sheet,
                    otherCostCents: Number.isFinite(amount) ? Math.round(amount * 100) : null,
                  })
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Cost per guest</Label>
              <p className="flex h-10 items-center text-lg font-semibold">{money(perGuest)}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Chosen: {chosen.dinner?.place.name || "no dinner venue"} ·{" "}
            {chosen.kids?.place.name || "no kids venue"} ·{" "}
            {chosen.transport?.place.name || "no transportation"}
          </p>
          {chosen.kids?.place.waiverUrl ? (
            <p className="text-sm">
              Kids waiver:{" "}
              <a className="text-primary underline" href={chosen.kids.place.waiverUrl} target="_blank" rel="noreferrer">
                {chosen.kids.place.waiverUrl}
              </a>
            </p>
          ) : null}
          <Button
            type="button"
            disabled={!canManage || isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await saveEventPlanningSheetAction({
                  eventId,
                  expectedHeadcount:
                    sheet.expectedHeadcount == null ? "" : String(sheet.expectedHeadcount),
                  otherCostDollars: centsToDollarInput(sheet.otherCostCents),
                  worksheetNotes: sheet.worksheetNotes || "",
                  whatsappGroupUrl: sheet.whatsappGroupUrl || "",
                  kidsMessage: sheet.kidsMessage || "",
                  kidsTicketTypeIds: sheet.kidsTicketTypeIds,
                })
                if (!result.success) setError(result.error)
                else load()
              })
            }
          >
            Save worksheet
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">People working the dinner</CardTitle>
          <p className="text-sm text-muted-foreground">
            Adds sign-up slots for registration, ushers, kids-program volunteers, and two babysitter
            openings. Paid kids-program staff stay on the Staff tab.
          </p>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            disabled={!canManage || isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await seedDinnerSignUpJobsAction(eventId)
                if (!result.success) setError(result.error)
                else {
                  router.refresh()
                  load()
                }
              })
            }
          >
            Add dinner sign-up jobs
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kids-program families</CardTitle>
          <p className="text-sm text-muted-foreground">
            Email families who bought a kids-program ticket, and keep a WhatsApp group link plus their
            phone numbers. The chosen kids venue’s waiver link is added to the email.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Kids-program ticket types</Label>
            <div className="flex flex-col gap-2">
              {ticketTypes.map((type) => {
                const checked = sheet.kidsTicketTypeIds.includes(type.id)
                return (
                  <label key={type.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!canManage}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...sheet.kidsTicketTypeIds, type.id]
                          : sheet.kidsTicketTypeIds.filter((id) => id !== type.id)
                        setSheet({ ...sheet, kidsTicketTypeIds: next })
                      }}
                    />
                    {type.name}
                  </label>
                )
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp-url">WhatsApp group link</Label>
            <Input
              id="whatsapp-url"
              value={sheet.whatsappGroupUrl || ""}
              disabled={!canManage}
              placeholder="https://"
              onChange={(event) => setSheet({ ...sheet, whatsappGroupUrl: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kids-message">Message</Label>
            <Textarea
              id="kids-message"
              value={sheet.kidsMessage || ""}
              disabled={!canManage}
              rows={4}
              onChange={(event) => setSheet({ ...sheet, kidsMessage: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-subject">Email subject</Label>
            <Input
              id="email-subject"
              value={emailSubject}
              disabled={!canManage}
              onChange={(event) => setEmailSubject(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!canManage || isPending}
              onClick={() =>
                startTransition(async () => {
                  const saved = await saveEventPlanningSheetAction({
                    eventId,
                    expectedHeadcount:
                      sheet.expectedHeadcount == null ? "" : String(sheet.expectedHeadcount),
                    otherCostDollars: centsToDollarInput(sheet.otherCostCents),
                    worksheetNotes: sheet.worksheetNotes || "",
                    whatsappGroupUrl: sheet.whatsappGroupUrl || "",
                    kidsMessage: sheet.kidsMessage || "",
                    kidsTicketTypeIds: sheet.kidsTicketTypeIds,
                  })
                  if (!saved.success) {
                    setError(saved.error)
                    return
                  }
                  refreshFamilies()
                })
              }
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Load families
            </Button>
            <Button
              type="button"
              disabled={!canManage || isPending || families.length === 0}
              onClick={() =>
                startTransition(async () => {
                  const result = await sendKidsProgramMessageAction({
                    eventId,
                    subject: emailSubject,
                    message: sheet.kidsMessage || "",
                  })
                  if (!result.success) setError(result.error)
                  else setError(null)
                })
              }
            >
              Email families
            </Button>
          </div>
          {families.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {families.map((family) => (
                <li key={family.email} className="rounded-md border px-3 py-2">
                  <p className="font-medium">{family.name}</p>
                  <p className="text-muted-foreground">
                    {family.email}
                    {family.phone ? ` · ${family.phone}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Load families after you mark which ticket types are the kids program.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function QuoteSection({
  kind,
  eventId,
  canManage,
  places,
  quotes,
  onChanged,
  onError,
}: {
  kind: EventPlanningKind
  eventId: string
  canManage: boolean
  places: EventPlanningPlace[]
  quotes: EventPlanningQuote[]
  onChanged: () => void
  onError: (message: string) => void
}) {
  const [placeId, setPlaceId] = useState("")
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [waiverUrl, setWaiverUrl] = useState("")
  const [price, setPrice] = useState("")
  const [notes, setNotes] = useState("")
  const [isPending, startTransition] = useTransition()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{EVENT_PLANNING_KIND_LABELS[kind]}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {quotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quotes yet.</p>
        ) : (
          <ul className="space-y-3">
            {quotes.map((quote) => (
              <QuoteRow
                key={quote.id}
                quote={quote}
                eventId={eventId}
                canManage={canManage}
                onChanged={onChanged}
                onError={onError}
              />
            ))}
          </ul>
        )}
        {canManage ? (
          <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Existing place</Label>
              <Select value={placeId} onValueChange={setPlaceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Or add a new one below" />
                </SelectTrigger>
                <SelectContent>
                  {places.map((place) => (
                    <SelectItem key={place.id} value={place.id}>
                      {place.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!placeId ? (
              <>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(event) => setName(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={address} onChange={(event) => setAddress(event.target.value)} />
                </div>
                {kind === "kids_venue" ? (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Waiver link</Label>
                    <Input
                      value={waiverUrl}
                      placeholder="https://"
                      onChange={(event) => setWaiverUrl(event.target.value)}
                    />
                  </div>
                ) : null}
              </>
            ) : null}
            <div className="space-y-2">
              <Label>Quote ($)</Label>
              <Input value={price} inputMode="decimal" onChange={(event) => setPrice(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>What’s included</Label>
              <Input value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await addEventPlanningQuoteAction({
                      eventId,
                      kind,
                      placeId: placeId || null,
                      name,
                      address,
                      waiverUrl,
                      priceDollars: price,
                      includedNotes: notes,
                    })
                    if (!result.success) {
                      onError(result.error)
                      return
                    }
                    setName("")
                    setAddress("")
                    setWaiverUrl("")
                    setPrice("")
                    setNotes("")
                    setPlaceId("")
                    onChanged()
                  })
                }
              >
                Add quote
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function QuoteRow({
  quote,
  eventId,
  canManage,
  onChanged,
  onError,
}: {
  quote: EventPlanningQuote
  eventId: string
  canManage: boolean
  onChanged: () => void
  onError: (message: string) => void
}) {
  const [status, setStatus] = useState<EventPlanningQuoteStatus>(quote.status)
  const [price, setPrice] = useState(centsToDollarInput(quote.priceCents))
  const [notes, setNotes] = useState(quote.includedNotes || "")
  const [isPending, startTransition] = useTransition()

  return (
    <li className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_8rem_8rem_auto]">
      <div>
        <p className="font-medium">{quote.place.name}</p>
        {quote.place.address ? (
          <p className="text-sm text-muted-foreground">{quote.place.address}</p>
        ) : null}
        {quote.referencePriceCents != null ? (
          <p className="text-xs text-muted-foreground">
            Last quote {money(quote.referencePriceCents)}
          </p>
        ) : null}
      </div>
      <Select
        value={status}
        onValueChange={(value) => setStatus(value as EventPlanningQuoteStatus)}
        disabled={!canManage}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="considering">Considering</SelectItem>
          <SelectItem value="chosen">Chosen</SelectItem>
          <SelectItem value="passed">Passed</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={price}
        inputMode="decimal"
        disabled={!canManage}
        onChange={(event) => setPrice(event.target.value)}
        aria-label="Quote amount"
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canManage || isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await updateEventPlanningQuoteAction({
                eventId,
                quoteId: quote.id,
                status,
                priceDollars: price,
                includedNotes: notes,
              })
              if (!result.success) onError(result.error)
              else onChanged()
            })
          }
        >
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!canManage || isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteEventPlanningQuoteAction({
                eventId,
                quoteId: quote.id,
              })
              if (!result.success) onError(result.error)
              else onChanged()
            })
          }
        >
          Remove
        </Button>
      </div>
      <Input
        className="sm:col-span-4"
        value={notes}
        disabled={!canManage}
        placeholder="What’s included"
        onChange={(event) => setNotes(event.target.value)}
      />
    </li>
  )
}

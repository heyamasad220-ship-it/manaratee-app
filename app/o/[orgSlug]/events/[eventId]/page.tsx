import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, FileText, MapPin } from "lucide-react"

import { PublicEventRegistrationForm } from "@/components/community-calendar/public-event-registration-form"
import { Button } from "@/components/ui/button"
import {
  buildPublicCommunityCalendarPath,
  buildPublicEventJoinHref,
} from "@/lib/community-calendar/public-paths"
import { getPublicCommunityEventBySlug } from "@/lib/community-calendar/public-queries"
import { listPublicEventDocuments } from "@/lib/events/event-document-actions"
import { createClient } from "@/lib/supabase/server"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"

export default async function PublicCommunityEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; eventId: string }>
  searchParams: Promise<{ checkout?: string; order?: string }>
}) {
  const { orgSlug, eventId } = await params
  const { checkout, order } = await searchParams
  const { organization, event, offerings } = await getPublicCommunityEventBySlug(
    orgSlug,
    eventId
  )

  if (!organization || !event) {
    notFound()
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const publicDocuments = await listPublicEventDocuments({
    organizationId: organization.id,
    eventId: event.id,
  })

  const buyHref = buildPublicEventJoinHref(organization.slug, event.id)
  const calendarHref = buildPublicCommunityCalendarPath(organization.slug)
  const metadata = user?.user_metadata ?? {}
  const defaultName = [
    String(metadata.first_name || metadata.firstName || "").trim(),
    String(metadata.last_name || metadata.lastName || "").trim(),
  ]
    .filter(Boolean)
    .join(" ")
  const defaultEmail = user?.email || ""

  return (
    <div className="min-h-screen bg-[#f4f6f5]">
      <header className="border-b border-zinc-200/80 bg-white/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href={calendarHref}
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Community Calendar
          </Link>
          <p className="text-sm text-zinc-500">{organization.name}</p>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="overflow-hidden rounded-2xl bg-zinc-200">
          {event.flyerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.flyerUrl}
              alt={`${event.name} flyer`}
              className="aspect-[3/4] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center bg-gradient-to-br from-teal-700 to-teal-900 px-6 text-center">
              <span className="text-xl font-semibold text-white/95">{event.name}</span>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
              {event.name}
            </h1>
            {event.dayTimeLabel ? (
              <p className="text-base text-zinc-700">{event.dayTimeLabel}</p>
            ) : null}
            {event.locationDetail ? (
              <p className="flex items-start gap-2 text-base text-zinc-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{event.locationDetail}</span>
              </p>
            ) : null}
            {event.description ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
                {event.description}
              </p>
            ) : null}
          </div>

          {checkout === "success" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Payment received
              {order ? ` for order ${order}` : ""}. A confirmation email is on
              the way if email is configured.
              {user ? (
                <>
                  {" "}
                  <Link href="/customer/tickets" className="font-medium underline">
                    View my tickets
                  </Link>
                </>
              ) : null}
            </div>
          ) : null}
          {checkout === "cancelled" ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Checkout was cancelled. Your seats stay reserved as pending until
              you complete payment or staff marks the order paid.
              {user ? (
                <>
                  {" "}
                  <Link href="/customer/tickets" className="font-medium underline">
                    Complete payment in My Tickets
                  </Link>
                </>
              ) : null}
            </div>
          ) : null}

          <div id="tickets" className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-zinc-900">Tickets</h2>
              {user ? (
                <Link
                  href="/customer/tickets"
                  className="text-sm font-medium text-teal-800 hover:underline"
                >
                  My tickets
                </Link>
              ) : null}
            </div>
            {offerings.length === 0 ? (
              <ul className="mt-3 space-y-2">
                {event.ticketPrices.map((ticket) => (
                  <li
                    key={`${ticket.name}-${ticket.priceCents}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-zinc-700">{ticket.name}</span>
                    <span className="font-medium text-zinc-900">
                      {ticket.priceCents === 0
                        ? "Free"
                        : ticket.label.replace(`${ticket.name} `, "")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {user ? (
              <PublicEventRegistrationForm
                orgSlug={organization.slug}
                eventId={event.id}
                offerings={offerings.length > 0 ? offerings : []}
                defaultName={defaultName}
                defaultEmail={defaultEmail}
              />
            ) : (
              <>
                {offerings.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {offerings.map((ticket) => (
                      <li
                        key={ticket.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="text-zinc-700">{ticket.name}</span>
                        <span className="font-medium text-zinc-900">
                          {ticket.priceCents === 0
                            ? "Free"
                            : formatTicketPrice(ticket.priceCents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Button asChild className="mt-5 w-full bg-teal-800 hover:bg-teal-900">
                  <Link href={buyHref}>Sign in to buy tickets</Link>
                </Button>
                <p className="mt-2 text-xs text-zinc-500">
                  You&apos;ll join or sign in with {organization.name}, then return
                  here to complete your ticket purchase.
                </p>
              </>
            )}
          </div>

          {publicDocuments.length > 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <h2 className="text-base font-semibold text-zinc-900">Documents</h2>
              <ul className="mt-3 space-y-2">
                {publicDocuments.map((doc) => (
                  <li key={doc.id}>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-teal-800 hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      {doc.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}

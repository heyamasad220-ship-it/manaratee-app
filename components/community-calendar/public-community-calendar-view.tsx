"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { MapPin } from "lucide-react"

import { CommunityFeaturedFlyer } from "@/components/community-calendar/community-featured-flyer"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  PublicCommunityCalendarEvent,
  PublicCommunityCalendarOrg,
  PublicCommunityEventType,
} from "@/lib/community-calendar/public-queries"
import {
  eventMatchesBrowseTab,
  type CommunityBrowseTab,
} from "@/lib/community-calendar/public-datetime"

function FlyerFrame({
  flyerUrl,
  name,
  className,
  priority = false,
  placeholder = false,
  focalX = 50,
  focalY = 50,
}: {
  flyerUrl: string | null
  name: string
  className?: string
  priority?: boolean
  placeholder?: boolean
  focalX?: number
  focalY?: number
}) {
  if (flyerUrl) {
    return (
      <div className={cn("relative overflow-hidden bg-zinc-200", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={flyerUrl}
          alt={`${name} flyer`}
          className="h-full w-full object-cover"
          style={{ objectPosition: `${focalX}% ${focalY}%` }}
          {...(priority ? { fetchPriority: "high" as const } : {})}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center px-4 text-center",
        placeholder
          ? "bg-gradient-to-br from-zinc-200 to-zinc-300"
          : "bg-gradient-to-br from-teal-700 to-teal-900",
        className
      )}
    >
      <span
        className={cn(
          "line-clamp-4 text-sm font-semibold leading-snug sm:text-base",
          placeholder ? "text-zinc-500" : "text-white/95"
        )}
      >
        {name}
      </span>
    </div>
  )
}

function EventCard({
  event,
  placeholder = false,
}: {
  event: PublicCommunityCalendarEvent
  placeholder?: boolean
}) {
  const body = (
    <>
      <FlyerFrame
        flyerUrl={event.flyerUrl}
        name={event.name}
        className="aspect-[3/4] w-full rounded-lg"
        placeholder={placeholder}
        focalX={event.flyerFocalX}
        focalY={event.flyerFocalY}
      />
      <div className="mt-3 space-y-1.5">
        <p
          className={cn(
            "line-clamp-2 text-sm font-semibold leading-snug",
            placeholder ? "text-zinc-400" : "text-zinc-900"
          )}
        >
          {event.name}
        </p>
        {event.dateLabel ? (
          <p className={cn("text-sm", placeholder ? "text-zinc-400" : "text-zinc-600")}>
            {event.dateLabel}
          </p>
        ) : null}
        {event.dayTimeLabel ? (
          <p className={cn("text-sm", placeholder ? "text-zinc-400" : "text-zinc-600")}>
            {event.dayTimeLabel}
          </p>
        ) : null}
        {event.locationDetail ? (
          <p
            className={cn(
              "line-clamp-2 text-sm",
              placeholder ? "text-zinc-400" : "text-zinc-500"
            )}
          >
            {event.locationDetail}
          </p>
        ) : null}
        <p
          className={cn(
            "text-sm font-medium",
            placeholder ? "text-zinc-400" : "text-zinc-800"
          )}
        >
          {event.priceSummary}
        </p>
      </div>
    </>
  )

  if (!placeholder && event.isClickable && event.href) {
    return (
      <Link
        href={event.href}
        className="block rounded-lg outline-none transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-teal-700"
      >
        {body}
      </Link>
    )
  }

  return <div className="block">{body}</div>
}

function categoryInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

const PLACEHOLDER_TYPES: PublicCommunityEventType[] = [
  { id: "ph-youth", name: "Youth", slug: "youth" },
  { id: "ph-seminars", name: "Seminars", slug: "seminars" },
  { id: "ph-ladies", name: "Ladies events", slug: "ladies" },
  { id: "ph-community", name: "Community", slug: "community" },
]

function buildPlaceholderEvent(
  index: number,
  orgName: string
): PublicCommunityCalendarEvent {
  const names = [
    "Community Night",
    "Youth Gathering",
    "Weekend Seminar",
    "Family Program",
  ]
  return {
    id: `placeholder-${index}`,
    source: "event",
    name: names[index] || `Event ${index + 1}`,
    eventDate: null,
    startAt: null,
    startLabel: null,
    dateLabel: "September 12, 2026",
    dayTimeLabel: "Saturday 11 a.m.",
    location: "Banquet Hall",
    locationDetail: "Banquet Hall — 123 Main St",
    flyerUrl: null,
    flyerFocalX: 50,
    flyerFocalY: 50,
    description: null,
    eventTypeId: null,
    eventTypeName: null,
    requiresTicketing: false,
    isClickable: false,
    href: null,
    priceSummary: index % 2 === 0 ? "Free" : "General Admission $50",
    ticketPrices: [],
    sortAt: Number.MAX_SAFE_INTEGER,
  }
}

function buildPlaceholderFeatured(orgName: string): PublicCommunityCalendarEvent {
  return {
    ...buildPlaceholderEvent(0, orgName),
    id: "placeholder-featured",
    name: "Featured upcoming event",
    dateLabel: "September 12, 2026",
    dayTimeLabel: "Saturday 11 a.m.",
    locationDetail: "Banquet Hall — 123 Main St",
    priceSummary: "Free",
  }
}

export function PublicCommunityCalendarView({
  organization,
  eventTypes,
  events,
  featured,
  /** Staff embed: no public chrome; page title comes from Header. */
  embedded = false,
  /** When no real events, show sample featured / circles / one row of cards. */
  showPlaceholdersWhenEmpty = false,
  /** Allow dragging the featured flyer crop (staff Event Management events). */
  canEditFeaturedFlyer = false,
}: {
  organization: PublicCommunityCalendarOrg
  eventTypes: PublicCommunityEventType[]
  events: PublicCommunityCalendarEvent[]
  featured: PublicCommunityCalendarEvent | null
  embedded?: boolean
  showPlaceholdersWhenEmpty?: boolean
  canEditFeaturedFlyer?: boolean
}) {
  const [browseTab, setBrowseTab] = useState<CommunityBrowseTab>("all")
  const [eventTypeId, setEventTypeId] = useState<string | null>(null)

  const usingPlaceholders =
    showPlaceholdersWhenEmpty && events.length === 0

  const displayTypes = usingPlaceholders
    ? PLACEHOLDER_TYPES
    : eventTypes.length > 0
      ? eventTypes
      : showPlaceholdersWhenEmpty
        ? PLACEHOLDER_TYPES
        : []

  const displayFeatured = usingPlaceholders
    ? buildPlaceholderFeatured(organization.name)
    : featured

  const displayEvents = usingPlaceholders
    ? [0, 1, 2, 3].map((index) =>
        buildPlaceholderEvent(index, organization.name)
      )
    : events

  const filtered = useMemo(() => {
    if (usingPlaceholders) return displayEvents
    return displayEvents.filter((event) => {
      if (eventTypeId && event.eventTypeId !== eventTypeId) return false
      return eventMatchesBrowseTab(event.eventDate, browseTab)
    })
  }, [browseTab, displayEvents, eventTypeId, usingPlaceholders])

  const content = (
    <div className={cn("space-y-10", embedded ? "" : "mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10")}>
      <section className="space-y-4">
        {!embedded ? (
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-teal-800/80">
              Featured
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
              Community Calendar
            </h1>
          </div>
        ) : (
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-teal-800/80">
            Featured
          </p>
        )}

        {displayFeatured ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
            <CommunityFeaturedFlyer
              eventId={displayFeatured.id}
              source={displayFeatured.source}
              flyerUrl={displayFeatured.flyerUrl}
              name={displayFeatured.name}
              focalX={displayFeatured.flyerFocalX}
              focalY={displayFeatured.flyerFocalY}
              className="aspect-[4/5] w-full max-h-[520px] rounded-2xl sm:aspect-[3/4]"
              priority
              placeholder={usingPlaceholders}
              editable={
                canEditFeaturedFlyer &&
                !usingPlaceholders &&
                displayFeatured.source === "event"
              }
            />
            <div className="space-y-4">
              <div className="space-y-2">
                <h2
                  className={cn(
                    "text-2xl font-semibold tracking-tight sm:text-3xl",
                    usingPlaceholders ? "text-zinc-400" : "text-zinc-900"
                  )}
                >
                  {displayFeatured.name}
                </h2>
                <p
                  className={cn(
                    "text-base",
                    usingPlaceholders ? "text-zinc-400" : "text-zinc-600"
                  )}
                >
                  Organization: {organization.name}
                </p>
                {displayFeatured.dateLabel ? (
                  <p
                    className={cn(
                      "text-base",
                      usingPlaceholders ? "text-zinc-400" : "text-zinc-700"
                    )}
                  >
                    {displayFeatured.dateLabel}
                  </p>
                ) : null}
                {displayFeatured.dayTimeLabel ? (
                  <p
                    className={cn(
                      "text-base",
                      usingPlaceholders ? "text-zinc-400" : "text-zinc-700"
                    )}
                  >
                    {displayFeatured.dayTimeLabel}
                  </p>
                ) : null}
                {displayFeatured.locationDetail ? (
                  <p
                    className={cn(
                      "flex items-start gap-2 text-base",
                      usingPlaceholders ? "text-zinc-400" : "text-zinc-600"
                    )}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{displayFeatured.locationDetail}</span>
                  </p>
                ) : null}
                <p
                  className={cn(
                    "text-base font-medium",
                    usingPlaceholders ? "text-zinc-400" : "text-zinc-900"
                  )}
                >
                  {displayFeatured.priceSummary}
                </p>
              </div>
              {!usingPlaceholders &&
              displayFeatured.isClickable &&
              displayFeatured.href ? (
                <Button asChild className="bg-teal-800 hover:bg-teal-900">
                  <Link href={displayFeatured.href}>
                    View event &amp; buy tickets
                  </Link>
                </Button>
              ) : usingPlaceholders ? (
                <Button
                  disabled
                  className="bg-zinc-300 text-zinc-500 hover:bg-zinc-300"
                >
                  View event &amp; buy tickets
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      {displayTypes.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900">Browse by type</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            <button
              type="button"
              onClick={() => setEventTypeId(null)}
              disabled={usingPlaceholders}
              className={cn(
                "flex w-20 shrink-0 flex-col items-center gap-2 text-center",
                eventTypeId === null ? "text-teal-900" : "text-zinc-600"
              )}
            >
              <span
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-full text-sm font-semibold",
                  eventTypeId === null
                    ? "bg-teal-800 text-white"
                    : "bg-white text-zinc-700 ring-1 ring-zinc-200"
                )}
              >
                All
              </span>
              <span className="text-xs font-medium">All</span>
            </button>
            {displayTypes.map((type) => {
              const active = eventTypeId === type.id
              return (
                <button
                  key={type.id}
                  type="button"
                  disabled={usingPlaceholders}
                  onClick={() =>
                    setEventTypeId((current) =>
                      current === type.id ? null : type.id
                    )
                  }
                  className={cn(
                    "flex w-20 shrink-0 flex-col items-center gap-2 text-center",
                    usingPlaceholders
                      ? "text-zinc-400"
                      : active
                        ? "text-teal-900"
                        : "text-zinc-600"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-16 w-16 items-center justify-center rounded-full text-sm font-semibold",
                      usingPlaceholders
                        ? "bg-zinc-100 text-zinc-400 ring-1 ring-zinc-200"
                        : active
                          ? "bg-teal-800 text-white"
                          : "bg-white text-zinc-700 ring-1 ring-zinc-200"
                    )}
                  >
                    {categoryInitials(type.name)}
                  </span>
                  <span className="line-clamp-2 text-xs font-medium">{type.name}</span>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Browse events</h2>
          <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1">
            {(
              [
                ["all", "All"],
                ["today", "Today"],
                ["weekend", "This weekend"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={usingPlaceholders}
                onClick={() => setBrowseTab(value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition",
                  browseTab === value
                    ? "bg-teal-800 text-white"
                    : "text-zinc-600 hover:text-zinc-900",
                  usingPlaceholders && browseTab !== value && "opacity-60"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((event) => (
            <EventCard
              key={`${event.source}:${event.id}`}
              event={event}
              placeholder={usingPlaceholders}
            />
          ))}
        </div>
      </section>
    </div>
  )

  if (embedded) {
    return content
  }

  return (
    <div className="min-h-screen bg-[#f4f6f5]">
      <header className="border-b border-zinc-200/80 bg-white/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <p className="text-sm font-medium text-zinc-800">{organization.name}</p>
          <p className="text-sm text-zinc-500">
            Already a member?{" "}
            <Link href="/login" className="font-medium text-teal-800 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </header>
      {content}
    </div>
  )
}

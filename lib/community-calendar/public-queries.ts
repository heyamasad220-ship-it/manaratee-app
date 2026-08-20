import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { getJoinOrganizationBySlug } from "@/lib/organizations/join-organization-actions"
import { loadOrganizationEnabledModuleSlugs } from "@/lib/modules/dashboard-module-access-server"
import { formatTicketPrice, getTicketOfferingSaleStatus } from "@/lib/tickets/ticket-types"
import type { EventTicketingConfig } from "@/lib/tickets/ticket-types"
import {
  buildPublicCommunityEventPath,
} from "@/lib/community-calendar/public-paths"
import { formatCommunityEventDayTime, formatCommunityEventDateLabel } from "@/lib/community-calendar/public-datetime"

export type PublicCommunityCalendarOrg = {
  id: string
  name: string
  slug: string
}

export type PublicCommunityTicketPrice = {
  name: string
  priceCents: number
  label: string
}

export type PublicCommunityEventType = {
  id: string
  name: string
  slug: string
}

export type PublicCommunityCalendarEvent = {
  id: string
  source: "event" | "bazaar"
  name: string
  eventDate: string | null
  startAt: string | null
  startLabel: string | null
  /** e.g. September 12, 2026 */
  dateLabel: string | null
  /** e.g. Saturday 6 p.m. */
  dayTimeLabel: string | null
  location: string | null
  locationDetail: string | null
  flyerUrl: string | null
  flyerFocalX: number
  flyerFocalY: number
  description: string | null
  eventTypeId: string | null
  eventTypeName: string | null
  requiresTicketing: boolean
  isClickable: boolean
  href: string | null
  priceSummary: string
  ticketPrices: PublicCommunityTicketPrice[]
  sortAt: number
}

function toDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 10) || null
  }
  return date.toISOString().slice(0, 10)
}

function formatTimeLabel(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

function clampFocal(value: unknown, fallback = 50) {
  const num = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(100, Math.max(0, num))
}

function buildInternalEventLocation(row: {
  location_label?: string | null
  location_address?: string | null
  venues?: { name?: string } | { name?: string }[] | null
}) {
  const venueEmbed = row.venues
  const venueName = Array.isArray(venueEmbed)
    ? venueEmbed[0]?.name?.trim()
    : venueEmbed?.name?.trim()
  const label = row.location_label?.trim() || null
  const address = row.location_address?.trim() || null

  if (label && label.toLowerCase() === "online") {
    return { location: "Online", locationDetail: "Online" }
  }

  const place = venueName || label
  if (place && address) {
    return { location: place, locationDetail: `${place} — ${address}` }
  }
  if (place) {
    return { location: place, locationDetail: place }
  }
  if (address) {
    return { location: address, locationDetail: address }
  }
  return { location: null, locationDetail: null }
}

function buildPriceSummary(ticketPrices: PublicCommunityTicketPrice[]) {
  if (ticketPrices.length === 0) return "Free"
  if (ticketPrices.every((row) => row.priceCents === 0)) return "Free"
  return ticketPrices.map((row) => row.label).join(", ")
}

function mapTicketRows(
  rows: Array<{ name?: string | null; price_cents?: number | null; is_active?: boolean | null; sort_order?: number | null }>
): PublicCommunityTicketPrice[] {
  return rows
    .filter((row) => row.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((row) => {
      const name = (row.name || "Ticket").trim() || "Ticket"
      const priceCents = Number(row.price_cents || 0)
      return {
        name,
        priceCents,
        label: `${name} ${formatTicketPrice(priceCents)}`,
      }
    })
}

/**
 * Public (no-login) Community Calendar — default published only.
 * Pass includeCommunityVisible for the staff preview of the same layout.
 */
export async function getPublicCommunityCalendarBySlug(
  orgSlug: string,
  options?: { includeCommunityVisible?: boolean }
): Promise<{
  organization: PublicCommunityCalendarOrg | null
  eventTypes: PublicCommunityEventType[]
  events: PublicCommunityCalendarEvent[]
  featured: PublicCommunityCalendarEvent | null
}> {
  const organization = await getJoinOrganizationBySlug(orgSlug)
  if (!organization) {
    return { organization: null, eventTypes: [], events: [], featured: null }
  }

  const enabledSlugs = await loadOrganizationEnabledModuleSlugs(organization.id)
  const includeBazaar = enabledSlugs.has("vendor-hub")
  const includeEvents = enabledSlugs.has("event-management")
  const includeCommunityVisible = options?.includeCommunityVisible === true
  const allowedStatuses = includeCommunityVisible
    ? ["published", "community_visible"]
    : ["published"]

  if (!includeBazaar && !includeEvents) {
    return { organization, eventTypes: [], events: [], featured: null }
  }

  const admin = getServiceRoleClient()
  const events: PublicCommunityCalendarEvent[] = []
  const eventTypes: PublicCommunityEventType[] = []

  if (includeEvents) {
    const { data: typeRows } = await admin
      .from("event_types")
      .select("id, name, slug, is_active, sort_order")
      .eq("organization_id", organization.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })

    for (const row of typeRows || []) {
      eventTypes.push({
        id: row.id as string,
        name: (row.name as string) || "Event type",
        slug: (row.slug as string) || (row.id as string),
      })
    }

    let eventQuery = admin
      .from("internal_events")
      .select(
        `
        id,
        name,
        start_at,
        end_at,
        location_label,
        location_address,
        flyer_url,
        flyer_focal_x,
        flyer_focal_y,
        description,
        requires_ticketing,
        community_calendar_status,
        event_type_id,
        event_types:event_type_id ( id, name ),
        venues:venue_id ( name )
      `
      )
      .eq("organization_id", organization.id)
      .order("start_at", { ascending: true, nullsFirst: false })

    eventQuery = includeCommunityVisible
      ? eventQuery.in("community_calendar_status", allowedStatuses)
      : eventQuery.eq("community_calendar_status", "published")

    let { data: eventRows, error } = await eventQuery

    if (
      error &&
      (error.message?.includes("flyer_focal") || error.code === "42703")
    ) {
      let fallbackQuery = admin
        .from("internal_events")
        .select(
          `
          id,
          name,
          start_at,
          end_at,
          location_label,
          location_address,
          flyer_url,
          description,
          requires_ticketing,
          community_calendar_status,
          event_type_id,
          event_types:event_type_id ( id, name ),
          venues:venue_id ( name )
        `
        )
        .eq("organization_id", organization.id)
        .order("start_at", { ascending: true, nullsFirst: false })

      fallbackQuery = includeCommunityVisible
        ? fallbackQuery.in("community_calendar_status", allowedStatuses)
        : fallbackQuery.eq("community_calendar_status", "published")

      const retry = await fallbackQuery
      eventRows = retry.data
      error = retry.error
    }

    if (
      error &&
      (error.message?.includes("community_calendar_status") ||
        error.code === "42703")
    ) {
      console.warn(
        "Public community calendar: run scripts/247_internal_event_community_calendar.sql"
      )
    } else if (error) {
      console.error("Public community calendar events:", error.message)
    } else {
      const internalIds = (eventRows || []).map((row) => row.id as string)
      const ticketsByEvent = new Map<string, PublicCommunityTicketPrice[]>()

      if (internalIds.length > 0) {
        let ticketQuery = await admin
          .from("event_ticket_types")
          .select(
            "internal_event_id, name, price_cents, is_active, sort_order, visibility"
          )
          .eq("organization_id", organization.id)
          .in("internal_event_id", internalIds)
          .eq("is_active", true)
          .order("sort_order", { ascending: true })

        if (
          ticketQuery.error &&
          (ticketQuery.error.message?.includes("visibility") ||
            ticketQuery.error.code === "42703")
        ) {
          ticketQuery = await admin
            .from("event_ticket_types")
            .select("internal_event_id, name, price_cents, is_active, sort_order")
            .eq("organization_id", organization.id)
            .in("internal_event_id", internalIds)
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
        }

        for (const row of ticketQuery.data || []) {
          const visibility =
            ((row as { visibility?: string | null }).visibility as string | null) ||
            "public"
          if (visibility === "private") continue
          const eventId = row.internal_event_id as string
          const list = ticketsByEvent.get(eventId) || []
          list.push(
            ...mapTicketRows([
              {
                name: row.name as string | null,
                price_cents: row.price_cents as number | null,
                is_active: true,
                sort_order: row.sort_order as number | null,
              },
            ])
          )
          ticketsByEvent.set(eventId, list)
        }
      }

      for (const row of eventRows || []) {
        const { location, locationDetail } = buildInternalEventLocation(
          row as {
            location_label?: string | null
            location_address?: string | null
            venues?: { name?: string } | { name?: string }[] | null
          }
        )

        const typeEmbed = (
          row as {
            event_types?: { id?: string; name?: string } | { id?: string; name?: string }[] | null
          }
        ).event_types
        const typeRow = Array.isArray(typeEmbed) ? typeEmbed[0] : typeEmbed
        const eventTypeId =
          (row.event_type_id as string | null) ||
          (typeRow?.id as string | undefined) ||
          null
        const eventTypeName = (typeRow?.name as string | undefined) || null

        const requiresTicketing = Boolean(row.requires_ticketing)
        const ticketPrices = ticketsByEvent.get(row.id as string) || []
        const isClickable = ticketPrices.length > 0
        const startAt = (row.start_at as string | null) ?? null
        const eventDate = toDateKey(startAt)
        const startLabel = formatTimeLabel(startAt)
        const focalRow = row as { flyer_focal_x?: number | null; flyer_focal_y?: number | null }

        events.push({
          id: row.id as string,
          source: "event",
          name: (row.name as string) || "Event",
          eventDate,
          startAt,
          startLabel,
          dateLabel: formatCommunityEventDateLabel({ eventDate, startAt }),
          dayTimeLabel: formatCommunityEventDayTime({
            eventDate,
            startAt,
            startLabel,
          }),
          location,
          locationDetail,
          flyerUrl: (row.flyer_url as string | null) ?? null,
          flyerFocalX: clampFocal(focalRow.flyer_focal_x),
          flyerFocalY: clampFocal(focalRow.flyer_focal_y),
          description: (row.description as string | null) ?? null,
          eventTypeId,
          eventTypeName,
          requiresTicketing,
          isClickable,
          href: isClickable
            ? buildPublicCommunityEventPath(organization.slug, row.id as string)
            : null,
          priceSummary: requiresTicketing
            ? buildPriceSummary(ticketPrices)
            : "Free",
          ticketPrices,
          sortAt: startAt ? new Date(startAt).getTime() : Number.MAX_SAFE_INTEGER,
        })
      }
    }
  }

  if (includeBazaar) {
    let bazaarQuery = admin
      .from("vendor_hub_events")
      .select(
        "id, name, event_date, start_time, location, flyer_url, description, calendar_status"
      )
      .eq("organization_id", organization.id)
      .order("event_date", { ascending: true, nullsFirst: false })

    bazaarQuery = includeCommunityVisible
      ? bazaarQuery.in("calendar_status", allowedStatuses)
      : bazaarQuery.eq("calendar_status", "published")

    const { data: bazaarRows, error } = await bazaarQuery

    if (error) {
      console.error("Public community calendar bazaars:", error.message)
    } else {
      for (const row of bazaarRows || []) {
        const eventDate = (row.event_date as string | null) ?? null
        const startLabel = (row.start_time as string | null) ?? null
        const location = (row.location as string | null) ?? null
        const sortAt = eventDate
          ? new Date(`${eventDate}T${(startLabel || "12:00:00").slice(0, 8)}`).getTime()
          : Number.MAX_SAFE_INTEGER

        events.push({
          id: row.id as string,
          source: "bazaar",
          name: (row.name as string) || "Bazaar",
          eventDate,
          startAt: null,
          startLabel,
          dateLabel: formatCommunityEventDateLabel({ eventDate, startAt: null }),
          dayTimeLabel: formatCommunityEventDayTime({
            eventDate,
            startAt: null,
            startLabel,
          }),
          location,
          locationDetail: location,
          flyerUrl: (row.flyer_url as string | null) ?? null,
          flyerFocalX: 50,
          flyerFocalY: 50,
          description: (row.description as string | null) ?? null,
          eventTypeId: null,
          eventTypeName: null,
          requiresTicketing: false,
          isClickable: false,
          href: null,
          priceSummary: "Free",
          ticketPrices: [],
          sortAt: Number.isFinite(sortAt) ? sortAt : Number.MAX_SAFE_INTEGER,
        })
      }
    }
  }

  events.sort((a, b) => {
    if (a.sortAt !== b.sortAt) return a.sortAt - b.sortAt
    return a.name.localeCompare(b.name)
  })

  const now = Date.now()
  const featured =
    events.find((event) => event.sortAt >= now) || events[0] || null

  // Only show category circles that have at least one published event
  const usedTypeIds = new Set(
    events.map((event) => event.eventTypeId).filter(Boolean) as string[]
  )
  const visibleTypes = eventTypes.filter((type) => usedTypeIds.has(type.id))

  return {
    organization,
    eventTypes: visibleTypes.length > 0 ? visibleTypes : eventTypes,
    events,
    featured,
  }
}

export type PublicEventOffering = {
  id: string
  name: string
  description: string | null
  priceCents: number
  quantityRemaining: number | null
  minPerOrder: number
  maxPerOrder: number | null
  onSale: boolean
  closedReason: string | null
}

export async function getPublicCommunityEventBySlug(
  orgSlug: string,
  eventId: string
): Promise<{
  organization: PublicCommunityCalendarOrg | null
  event: PublicCommunityCalendarEvent | null
  offerings: PublicEventOffering[]
}> {
  const catalog = await getPublicCommunityCalendarBySlug(orgSlug)
  if (!catalog.organization) {
    return { organization: null, event: null, offerings: [] }
  }

  const event =
    catalog.events.find(
      (item) => item.id === eventId && item.source === "event" && item.isClickable
    ) || null

  if (!event) {
    return { organization: catalog.organization, event: null, offerings: [] }
  }

  const admin = getServiceRoleClient()
  const { data: eventRow } = await admin
    .from("internal_events")
    .select("ticketing_config")
    .eq("id", eventId)
    .eq("organization_id", catalog.organization.id)
    .maybeSingle()

  const eventConfig = (eventRow?.ticketing_config || {}) as EventTicketingConfig

  let typeQuery = await admin
    .from("event_ticket_types")
    .select(
      "id, name, description, price_cents, quantity_total, quantity_sold, is_active, sales_start_at, sales_end_at, visibility, min_per_order, max_per_order, sort_order"
    )
    .eq("organization_id", catalog.organization.id)
    .eq("internal_event_id", eventId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (
    typeQuery.error &&
    (typeQuery.error.message?.includes("visibility") ||
      typeQuery.error.message?.includes("min_per_order") ||
      typeQuery.error.code === "42703")
  ) {
    typeQuery = await admin
      .from("event_ticket_types")
      .select(
        "id, name, description, price_cents, quantity_total, quantity_sold, is_active, sales_start_at, sales_end_at, sort_order"
      )
      .eq("organization_id", catalog.organization.id)
      .eq("internal_event_id", eventId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
  }

  const offerings: PublicEventOffering[] = []
  for (const row of typeQuery.data || []) {
    const visibility =
      ((row as { visibility?: string | null }).visibility as string | null) || "public"
    if (visibility === "private") continue

    const saleStatus = getTicketOfferingSaleStatus({
      eventConfig,
      offeringSalesStartAt: row.sales_start_at as string | null,
      offeringSalesEndAt: row.sales_end_at as string | null,
    })
    const total = row.quantity_total as number | null
    const sold = Number(row.quantity_sold || 0)
    const remaining = total == null ? null : Math.max(0, total - sold)
    const minPerOrder = Math.max(1, Number((row as { min_per_order?: number }).min_per_order || 1))
    const maxRaw = (row as { max_per_order?: number | null }).max_per_order
    const maxPerOrder = maxRaw != null ? Number(maxRaw) : remaining

    offerings.push({
      id: row.id as string,
      name: ((row.name as string) || "Ticket").trim() || "Ticket",
      description: (row.description as string | null) || null,
      priceCents: Number(row.price_cents || 0),
      quantityRemaining: remaining,
      minPerOrder,
      maxPerOrder:
        remaining != null && maxPerOrder != null
          ? Math.min(maxPerOrder, remaining)
          : maxPerOrder,
      onSale: saleStatus.onSale && (remaining == null || remaining > 0),
      closedReason: !saleStatus.onSale
        ? saleStatus.reason || "Registration is closed."
        : remaining === 0
          ? "Sold out"
          : null,
    })
  }

  return { organization: catalog.organization, event, offerings }
}

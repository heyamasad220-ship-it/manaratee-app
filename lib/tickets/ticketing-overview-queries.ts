"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import type { TicketingSalesStatus } from "./ticket-types"
import type { TicketedEventOverviewRow } from "./ticketing-overview-types"
import { ticketOrderNetRevenueCents } from "@/lib/tickets/ticket-refund-math"

const PAGE_SIZE = 1000

function resolveSalesStatus(config: Record<string, unknown> | null | undefined): TicketingSalesStatus {
  const status = config?.salesStatus
  if (status === "published" || status === "draft" || status === "sales_closed") {
    return status
  }
  return "draft"
}

async function fetchAllPages<T>(
  query: (
    from: number,
    to: number
  ) => PromiseLike<{
    data: T[] | null
    error: { message?: string; code?: string } | null
  }>
): Promise<{ data: T[]; error: { message?: string; code?: string } | null }> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1)
    if (error) return { data: rows, error }
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
  }
  return { data: rows, error: null }
}

const EVENT_SELECT = `
        id,
        name,
        start_at,
        end_at,
        location_label,
        ticketing_config,
        ticketing_category_id,
        ticketing_event_categories:ticketing_category_id ( name ),
        venues:venue_id ( name )
      `

const EVENT_SELECT_WITHOUT_CATEGORY = `
        id,
        name,
        start_at,
        end_at,
        location_label,
        ticketing_config,
        venues:venue_id ( name )
      `

export async function getTicketedEventsOverview(): Promise<TicketedEventOverviewRow[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const loadEvents = (select: string) =>
    fetchAllPages((from, to) =>
      supabase
        .from("internal_events")
        .select(select)
        .eq("organization_id", organizationId)
        .eq("requires_ticketing", true)
        .order("start_at", { ascending: false, nullsFirst: false })
        .range(from, to)
    )

  let eventsResult = await loadEvents(EVENT_SELECT)
  if (eventsResult.error?.code === "42703") {
    eventsResult = await loadEvents(EVENT_SELECT_WITHOUT_CATEGORY)
  }

  if (eventsResult.error) {
    if (eventsResult.error.code === "42P01" || eventsResult.error.code === "42703") {
      return []
    }
    console.error(eventsResult.error)
    throw new Error("Failed to load ticketed events")
  }

  const events = eventsResult.data
  if (!events.length) {
    return []
  }

  const eventIds = events.map((row) => row.id as string)
  const eventIdSet = new Set(eventIds)

  const [typesResult, ordersResult] = await Promise.all([
    fetchAllPages((from, to) =>
      supabase
        .from("event_ticket_types")
        .select("internal_event_id, quantity_total, quantity_sold")
        .eq("organization_id", organizationId)
        .range(from, to)
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("ticket_orders")
        .select("internal_event_id, total_cents, refunded_amount_cents, currency, status")
        .eq("organization_id", organizationId)
        .in("status", ["completed", "partially_refunded"])
        .range(from, to)
    ),
  ])

  let orderRows = ordersResult.data
  if (ordersResult.error?.code === "42703") {
    const fallback = await fetchAllPages((from, to) =>
      supabase
        .from("ticket_orders")
        .select("internal_event_id, total_cents, currency, status")
        .eq("organization_id", organizationId)
        .in("status", ["completed", "partially_refunded"])
        .range(from, to)
    )
    if (fallback.error && fallback.error.code !== "42P01") {
      console.error(fallback.error)
      throw new Error("Failed to load ticketed event revenue")
    }
    orderRows = fallback.data
  } else if (ordersResult.error) {
    if (ordersResult.error.code === "42P01") {
      orderRows = []
    } else {
      console.error(ordersResult.error)
      throw new Error("Failed to load ticketed event revenue")
    }
  }

  if (typesResult.error && typesResult.error.code !== "42P01" && typesResult.error.code !== "42703") {
    console.error(typesResult.error)
    throw new Error("Failed to load ticket types")
  }

  const typesByEvent = new Map<string, { issued: number; capacity: number | null }>()

  for (const eventId of eventIds) {
    typesByEvent.set(eventId, { issued: 0, capacity: 0 })
  }

  for (const row of typesResult.data || []) {
    const eventId = row.internal_event_id as string
    if (!eventIdSet.has(eventId)) continue
    const current = typesByEvent.get(eventId) || { issued: 0, capacity: 0 }
    current.issued += Number(row.quantity_sold || 0)

    if (row.quantity_total == null) {
      current.capacity = null
    } else if (current.capacity !== null) {
      current.capacity += Number(row.quantity_total || 0)
    }

    typesByEvent.set(eventId, current)
  }

  const revenueByEvent = new Map<string, { cents: number; currency: string }>()
  for (const row of orderRows) {
    const eventId = row.internal_event_id as string
    if (!eventIdSet.has(eventId)) continue
    const existing = revenueByEvent.get(eventId) || { cents: 0, currency: "USD" }
    existing.cents += ticketOrderNetRevenueCents({
      status: row.status as string,
      totalCents: Number(row.total_cents || 0),
      refundedAmountCents: Number(
        (row as { refunded_amount_cents?: number }).refunded_amount_cents || 0
      ),
    })
    existing.currency = (row.currency as string) || existing.currency
    revenueByEvent.set(eventId, existing)
  }

  return events.map((row: any) => {
    const stats = typesByEvent.get(row.id) || { issued: 0, capacity: 0 }
    const revenue = revenueByEvent.get(row.id) || { cents: 0, currency: "USD" }
    const capacity = stats.capacity
    const remaining =
      capacity == null ? null : Math.max(capacity - stats.issued, 0)

    return {
      id: row.id as string,
      name: row.name as string,
      venueName: Array.isArray(row.venues) ? row.venues[0]?.name ?? null : row.venues?.name ?? null,
      locationLabel: row.location_label ?? null,
      startAt: row.start_at ?? null,
      endAt: row.end_at ?? null,
      salesStatus: resolveSalesStatus(row.ticketing_config),
      ticketsIssued: stats.issued,
      ticketsCapacity: capacity,
      ticketsRemaining: remaining,
      revenueCents: revenue.cents,
      currency: revenue.currency,
      ticketingCategoryId: (row.ticketing_category_id as string | null) ?? null,
      ticketingCategoryName:
        (Array.isArray(row.ticketing_event_categories)
          ? row.ticketing_event_categories[0]?.name
          : row.ticketing_event_categories?.name) ?? null,
    }
  })
}

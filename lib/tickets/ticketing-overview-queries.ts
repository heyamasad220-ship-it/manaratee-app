"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import type { TicketingSalesStatus } from "./ticket-types"
import type { TicketedEventOverviewRow } from "./ticketing-overview-types"

function resolveSalesStatus(config: Record<string, unknown> | null | undefined): TicketingSalesStatus {
  const status = config?.salesStatus
  if (status === "published" || status === "draft" || status === "sales_closed") {
    return status
  }
  return "draft"
}

export async function getTicketedEventsOverview(): Promise<TicketedEventOverviewRow[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data: events, error: eventsError } = await supabase
    .from("internal_events")
    .select(`
      id,
      name,
      start_at,
      end_at,
      location_label,
      ticketing_config,
      venues:venue_id ( name )
    `)
    .eq("organization_id", organizationId)
    .eq("requires_ticketing", true)
    .order("start_at", { ascending: false, nullsFirst: false })

  if (eventsError) {
    if (eventsError.code === "42P01" || eventsError.code === "42703") return []
    console.error(eventsError)
    throw new Error("Failed to load ticketed events")
  }

  if (!events?.length) {
    return []
  }

  const eventIds = events.map((row) => row.id as string)

  const [typesResult, ordersResult] = await Promise.all([
    supabase
      .from("event_ticket_types")
      .select("internal_event_id, quantity_total, quantity_sold, is_active")
      .eq("organization_id", organizationId)
      .in("internal_event_id", eventIds),
    supabase
      .from("ticket_orders")
      .select("internal_event_id, total_cents, currency, status")
      .eq("organization_id", organizationId)
      .in("internal_event_id", eventIds)
      .in("status", ["completed", "partially_refunded"]),
  ])

  const typesByEvent = new Map<string, { issued: number; capacity: number | null }>()

  for (const eventId of eventIds) {
    typesByEvent.set(eventId, { issued: 0, capacity: 0 })
  }

  for (const row of typesResult.data || []) {
    if (row.is_active === false) continue
    const eventId = row.internal_event_id as string
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
  for (const row of ordersResult.data || []) {
    const eventId = row.internal_event_id as string
    const existing = revenueByEvent.get(eventId) || { cents: 0, currency: "USD" }
    existing.cents += Number(row.total_cents || 0)
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
      venueName: row.venues?.name ?? null,
      locationLabel: row.location_label ?? null,
      startAt: row.start_at ?? null,
      endAt: row.end_at ?? null,
      salesStatus: resolveSalesStatus(row.ticketing_config),
      ticketsIssued: stats.issued,
      ticketsCapacity: capacity,
      ticketsRemaining: remaining,
      revenueCents: revenue.cents,
      currency: revenue.currency,
    }
  })
}

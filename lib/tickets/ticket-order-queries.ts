"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { isTicketedEventPast } from "@/lib/tickets/ticketing-overview-types"

export type TicketOrderStatus =
  | "pending"
  | "completed"
  | "canceled"
  | "refunded"
  | "partially_refunded"

export type TicketOrderListItem = {
  id: string
  orderNumber: string
  status: TicketOrderStatus
  totalCents: number
  currency: string
  purchaserName: string | null
  purchaserEmail: string
  paymentMethod: string | null
  paymentReference: string | null
  createdAt: string
  eventId: string
  eventName: string
  eventVenueName: string | null
  eventStartAt: string | null
  ticketCount: number
  ticketCodes: string[]
}

export type TicketOverviewStats = {
  ordersCount: number
  ticketsIssued: number
  totalRevenueCents: number
  currency: string
}

export type TicketedEventOption = {
  id: string
  name: string
  startAt: string | null
  endAt: string | null
}

function mapOrderStatus(status: string): TicketOrderStatus {
  if (
    status === "pending" ||
    status === "completed" ||
    status === "canceled" ||
    status === "refunded" ||
    status === "partially_refunded"
  ) {
    return status
  }
  return "pending"
}

export async function getTicketOverviewStats(): Promise<TicketOverviewStats> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return { ordersCount: 0, ticketsIssued: 0, totalRevenueCents: 0, currency: "USD" }
  }

  const [ordersResult, ticketsResult] = await Promise.all([
    supabase
      .from("ticket_orders")
      .select("total_cents, currency, status")
      .eq("organization_id", organizationId)
      .in("status", ["completed", "partially_refunded"]),
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["valid", "checked_in"]),
  ])

  if (ordersResult.error?.code === "42P01" || ticketsResult.error?.code === "42P01") {
    return { ordersCount: 0, ticketsIssued: 0, totalRevenueCents: 0, currency: "USD" }
  }

  const orders = ordersResult.data || []
  const totalRevenueCents = orders.reduce(
    (sum, row) => sum + Number(row.total_cents || 0),
    0
  )

  return {
    ordersCount: orders.length,
    ticketsIssued: ticketsResult.count || 0,
    totalRevenueCents,
    currency: orders[0]?.currency || "USD",
  }
}

export async function getTicketOrders(input?: {
  eventId?: string
  status?: TicketOrderStatus | "all"
  dateFrom?: string
  dateTo?: string
  search?: string
}): Promise<TicketOrderListItem[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  let query = supabase
    .from("ticket_orders")
    .select(`
      id,
      order_number,
      status,
      total_cents,
      currency,
      purchaser_name,
      purchaser_email,
      payment_method,
      payment_reference,
      created_at,
      internal_event_id,
      internal_events:internal_event_id (
        name,
        start_at,
        location_label,
        venues:venue_id ( name )
      )
    `)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })

  if (input?.eventId && input.eventId !== "all") {
    query = query.eq("internal_event_id", input.eventId)
  }

  if (input?.status && input.status !== "all") {
    query = query.eq("status", input.status)
  }

  if (input?.dateFrom) {
    query = query.gte("created_at", `${input.dateFrom}T00:00:00.000Z`)
  }

  if (input?.dateTo) {
    query = query.lte("created_at", `${input.dateTo}T23:59:59.999Z`)
  }

  const { data, error } = await query

  if (error) {
    if (error.code === "42P01") return []
    console.error(error)
    throw new Error("Failed to load ticket orders")
  }

  const orderIds = (data || []).map((row) => row.id as string)
  const ticketCounts = new Map<string, number>()
  const ticketCodesByOrder = new Map<string, string[]>()

  if (orderIds.length > 0) {
    const { data: ticketRows, error: ticketError } = await supabase
      .from("tickets")
      .select("ticket_order_id, ticket_code")
      .eq("organization_id", organizationId)
      .in("ticket_order_id", orderIds)

    if (!ticketError && ticketRows) {
      for (const row of ticketRows) {
        const orderId = row.ticket_order_id as string
        ticketCounts.set(orderId, (ticketCounts.get(orderId) || 0) + 1)
        const codes = ticketCodesByOrder.get(orderId) || []
        codes.push(row.ticket_code as string)
        ticketCodesByOrder.set(orderId, codes)
      }
    }
  }

  const search = input?.search?.trim().toLowerCase() || ""
  let matchingOrderIds: Set<string> | null = null

  if (search) {
    const { data: ticketMatches } = await supabase
      .from("tickets")
      .select("ticket_order_id")
      .eq("organization_id", organizationId)
      .ilike("ticket_code", `%${search}%`)

    if (ticketMatches?.length) {
      matchingOrderIds = new Set(
        ticketMatches.map((row) => row.ticket_order_id as string)
      )
    }
  }

  return (data || [])
    .map((row: any) => ({
      id: row.id as string,
      orderNumber: row.order_number as string,
      status: mapOrderStatus(row.status as string),
      totalCents: Number(row.total_cents || 0),
      currency: (row.currency as string) || "USD",
      purchaserName: (row.purchaser_name as string | null) ?? null,
      purchaserEmail: row.purchaser_email as string,
      paymentMethod: (row.payment_method as string | null) ?? null,
      paymentReference: (row.payment_reference as string | null) ?? null,
      createdAt: row.created_at as string,
      eventId: row.internal_event_id as string,
      eventName: row.internal_events?.name || "Unknown event",
      eventVenueName:
        row.internal_events?.venues?.name ||
        row.internal_events?.location_label ||
        null,
      eventStartAt: row.internal_events?.start_at ?? null,
      ticketCount: ticketCounts.get(row.id as string) || 0,
      ticketCodes: ticketCodesByOrder.get(row.id as string) || [],
    }))
    .filter((order) => {
      if (!search) return true
      if (matchingOrderIds?.has(order.id)) return true
      return (
        order.orderNumber.toLowerCase().includes(search) ||
        order.purchaserName?.toLowerCase().includes(search) ||
        order.purchaserEmail.toLowerCase().includes(search) ||
        order.paymentReference?.toLowerCase().includes(search) ||
        order.eventName.toLowerCase().includes(search)
      )
    })
}

export async function getTicketedEvents(): Promise<TicketedEventOption[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("internal_events")
    .select("id, name, start_at, end_at")
    .eq("organization_id", organizationId)
    .eq("requires_ticketing", true)
    .order("start_at", { ascending: false, nullsFirst: false })

  if (error) {
    if (error.code === "42P01" || error.code === "42703") return []
    console.error(error)
    return []
  }

  const mapped = (data || []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    startAt: (row.start_at as string | null) ?? null,
    endAt: (row.end_at as string | null) ?? null,
  }))

  const active = mapped
    .filter((event) => !isTicketedEventPast(event))
    .sort((a, b) => {
      const aTime = a.startAt ? new Date(a.startAt).getTime() : Number.MAX_SAFE_INTEGER
      const bTime = b.startAt ? new Date(b.startAt).getTime() : Number.MAX_SAFE_INTEGER
      return aTime - bTime
    })

  const past = mapped
    .filter((event) => isTicketedEventPast(event))
    .sort((a, b) => {
      const aTime = a.startAt ? new Date(a.startAt).getTime() : 0
      const bTime = b.startAt ? new Date(b.startAt).getTime() : 0
      return bTime - aTime
    })

  return [...active, ...past]
}

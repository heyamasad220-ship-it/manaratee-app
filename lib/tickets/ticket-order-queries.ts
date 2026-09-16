"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { isTicketedEventPast } from "@/lib/tickets/ticketing-overview-types"
import { ticketOrderNetRevenueCents } from "@/lib/tickets/ticket-refund-math"

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
  refundedAmountCents: number
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

  const pageSize = 1000
  const orderRows: Array<{
    total_cents?: number | null
    refunded_amount_cents?: number | null
    currency?: string | null
    status?: string | null
  }> = []

  for (let from = 0; ; from += pageSize) {
    const page = await supabase
      .from("ticket_orders")
      .select("total_cents, refunded_amount_cents, currency, status")
      .eq("organization_id", organizationId)
      .in("status", ["completed", "partially_refunded"])
      .range(from, from + pageSize - 1)

    const query =
      page.error?.code === "42703"
        ? await supabase
            .from("ticket_orders")
            .select("total_cents, currency, status")
            .eq("organization_id", organizationId)
            .in("status", ["completed", "partially_refunded"])
            .range(from, from + pageSize - 1)
        : page

    if (query.error?.code === "42P01") {
      return { ordersCount: 0, ticketsIssued: 0, totalRevenueCents: 0, currency: "USD" }
    }
    if (query.error) {
      console.error(query.error)
      throw new Error("Failed to load ticket overview stats")
    }

    orderRows.push(...(query.data || []))
    if (!query.data || query.data.length < pageSize) break
  }

  const ticketsResult = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", ["valid", "checked_in"])

  if (ticketsResult.error?.code === "42P01") {
    return { ordersCount: 0, ticketsIssued: 0, totalRevenueCents: 0, currency: "USD" }
  }

  const totalRevenueCents = orderRows.reduce(
    (sum, row) =>
      sum +
      ticketOrderNetRevenueCents({
        status: row.status as string,
        totalCents: Number(row.total_cents || 0),
        refundedAmountCents: Number(row.refunded_amount_cents || 0),
      }),
    0
  )

  return {
    ordersCount: orderRows.length,
    ticketsIssued: ticketsResult.count || 0,
    totalRevenueCents,
    currency: orderRows[0]?.currency || "USD",
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
      refunded_amount_cents,
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

  if (error?.code === "42703") {
    let fallbackQuery = supabase
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
      fallbackQuery = fallbackQuery.eq("internal_event_id", input.eventId)
    }
    if (input?.status && input.status !== "all") {
      fallbackQuery = fallbackQuery.eq("status", input.status)
    }
    if (input?.dateFrom) {
      fallbackQuery = fallbackQuery.gte("created_at", `${input.dateFrom}T00:00:00.000Z`)
    }
    if (input?.dateTo) {
      fallbackQuery = fallbackQuery.lte("created_at", `${input.dateTo}T23:59:59.999Z`)
    }

    const fallback = await fallbackQuery
    return mapTicketOrderListItems(fallback.data, fallback.error, organizationId, input, supabase)
  }

  return mapTicketOrderListItems(data, error, organizationId, input, supabase)
}

async function mapTicketOrderListItems(
  data: unknown[] | null,
  error: { message?: string; code?: string } | null,
  organizationId: string,
  input:
    | {
        eventId?: string
        status?: TicketOrderStatus | "all"
        dateFrom?: string
        dateTo?: string
        search?: string
      }
    | undefined,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<TicketOrderListItem[]> {
  if (error) {
    if (error.code === "42P01") return []
    console.error(error)
    throw new Error("Failed to load ticket orders")
  }

  const orderIds = (data || []).map((row) => (row as { id: string }).id)
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
      refundedAmountCents: Number(row.refunded_amount_cents || 0),
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

export type EventAttendeeTicketStatus =
  | "valid"
  | "checked_in"
  | "waitlisted"
  | "canceled"
  | "refunded"

export type EventAttendeeListItem = {
  id: string
  ticketCode: string
  attendeeName: string | null
  attendeeEmail: string | null
  status: EventAttendeeTicketStatus
  checkedInAt: string | null
  createdAt: string
  ticketTypeName: string
  ticketTypePriceCents: number
  orderId: string
  orderNumber: string
  orderStatus: TicketOrderStatus
  orderTotalCents: number
  orderRefundedCents: number
  currency: string
  purchaserName: string | null
  purchaserEmail: string | null
  purchaserPhone: string | null
  contactId: string | null
  paymentMethod: string | null
  paymentReference: string | null
  orderCreatedAt: string | null
}

function mapTicketStatus(status: string): EventAttendeeTicketStatus {
  if (
    status === "valid" ||
    status === "checked_in" ||
    status === "waitlisted" ||
    status === "canceled" ||
    status === "refunded"
  ) {
    return status
  }
  return "valid"
}

/** One row per ticket/attendee seat for an event (paid or free). */
export async function getEventAttendees(
  eventId: string
): Promise<EventAttendeeListItem[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId || !eventId) {
    return []
  }

  const { data, error } = await supabase
    .from("tickets")
    .select(
      `
      id,
      ticket_code,
      attendee_name,
      attendee_email,
      status,
      checked_in_at,
      created_at,
      ticket_order_id,
      event_ticket_types:ticket_type_id (
        name,
        price_cents
      ),
      ticket_orders:ticket_order_id (
        order_number,
        status,
        total_cents,
        refunded_amount_cents,
        currency,
        purchaser_name,
        purchaser_email,
        contact_id,
        payment_method,
        payment_reference,
        created_at,
        contacts:contact_id (
          phone
        )
      )
    `
    )
    .eq("organization_id", organizationId)
    .eq("internal_event_id", eventId)
    .order("created_at", { ascending: false })

  if (error?.code === "42703") {
    const fallback = await supabase
      .from("tickets")
      .select(
        `
        id,
        ticket_code,
        attendee_name,
        attendee_email,
        status,
        checked_in_at,
        created_at,
        ticket_order_id,
        event_ticket_types:ticket_type_id (
          name,
          price_cents
        ),
        ticket_orders:ticket_order_id (
          order_number,
          status,
          total_cents,
          currency,
          purchaser_name,
          purchaser_email,
          contact_id,
          payment_method,
          payment_reference,
          created_at,
          contacts:contact_id (
            phone
          )
        )
      `
      )
      .eq("organization_id", organizationId)
      .eq("internal_event_id", eventId)
      .order("created_at", { ascending: false })
    return mapEventAttendeeRows(fallback.data, fallback.error)
  }

  return mapEventAttendeeRows(data, error)
}

function mapEventAttendeeRows(
  data: unknown[] | null,
  error: { message?: string; code?: string } | null
): EventAttendeeListItem[] {
  if (error) {
    if (error.code === "42P01" || error.code === "42703") return []
    console.error(error)
    throw new Error("Failed to load event attendees")
  }

  return (data || []).map((row: any) => {
    const ticketType = Array.isArray(row.event_ticket_types)
      ? row.event_ticket_types[0]
      : row.event_ticket_types
    const order = Array.isArray(row.ticket_orders)
      ? row.ticket_orders[0]
      : row.ticket_orders
    const contact = Array.isArray(order?.contacts)
      ? order.contacts[0]
      : order?.contacts
    const purchaserEmail = (order?.purchaser_email as string | null) ?? null
    const rawAttendeeEmail = (row.attendee_email as string | null) ?? null
    const attendeeEmail =
      rawAttendeeEmail &&
      purchaserEmail &&
      rawAttendeeEmail.trim().toLowerCase() === purchaserEmail.trim().toLowerCase()
        ? null
        : rawAttendeeEmail

    return {
      id: row.id as string,
      ticketCode: (row.ticket_code as string) || "",
      attendeeName: (row.attendee_name as string | null) ?? null,
      attendeeEmail,
      status: mapTicketStatus(row.status as string),
      checkedInAt: (row.checked_in_at as string | null) ?? null,
      createdAt: row.created_at as string,
      ticketTypeName: (ticketType?.name as string) || "Ticket",
      ticketTypePriceCents: Number(ticketType?.price_cents || 0),
      orderId: (row.ticket_order_id as string) || "",
      orderNumber: (order?.order_number as string) || "—",
      orderStatus: mapOrderStatus((order?.status as string) || "pending"),
      orderTotalCents: Number(order?.total_cents || 0),
      orderRefundedCents: Number(order?.refunded_amount_cents || 0),
      currency: (order?.currency as string) || "USD",
      purchaserName: (order?.purchaser_name as string | null) ?? null,
      purchaserEmail,
      purchaserPhone: (contact?.phone as string | null) ?? null,
      contactId: (order?.contact_id as string | null) ?? null,
      paymentMethod: (order?.payment_method as string | null) ?? null,
      paymentReference: (order?.payment_reference as string | null) ?? null,
      orderCreatedAt: (order?.created_at as string | null) ?? null,
    }
  })
}


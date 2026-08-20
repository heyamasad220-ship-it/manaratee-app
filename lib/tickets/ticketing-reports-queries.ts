import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  ticketOrderNetRevenueCents,
  ticketOrderRefundedCents,
} from "@/lib/tickets/ticket-refund-math"

export type TicketingReportRangeKey = "7d" | "30d" | "90d" | "1y"

export type TicketingReportOverview = {
  rangeKey: TicketingReportRangeKey
  rangeStart: string
  rangeEnd: string
  totalSalesCents: number
  totalSalesChangePct: number | null
  ticketsSold: number
  ticketsSoldChangePct: number | null
  avgOrderValueCents: number
  avgOrderValueChangePct: number | null
  uniqueCustomers: number
  uniqueCustomersChangePct: number | null
  currency: string
  topEvents: TicketingReportEventRow[]
}

export type TicketingReportSalesRow = {
  dateKey: string
  dateLabel: string
  orders: number
  tickets: number
  grossSalesCents: number
  refundsCents: number
  netSalesCents: number
}

export type TicketingReportEventRow = {
  eventId: string
  eventName: string
  eventStartAt: string | null
  capacity: number | null
  ticketsSold: number
  fillRatePct: number | null
  revenueCents: number
  currency: string
}

export type TicketingReportCustomerRow = {
  key: string
  name: string
  email: string
  orders: number
  tickets: number
  totalSpentCents: number
  currency: string
}

export type TicketingReportsData = {
  overview: TicketingReportOverview
  salesByDay: TicketingReportSalesRow[]
  events: TicketingReportEventRow[]
  customers: TicketingReportCustomerRow[]
}

const REVENUE_STATUSES = ["completed", "partially_refunded"] as const
const COLLECTED_STATUSES = ["completed", "partially_refunded", "refunded"] as const
const TICKET_STATUSES = ["valid", "checked_in"] as const

type OrderRow = {
  id: string
  status: string
  total_cents: number | null
  refunded_amount_cents?: number | null
  currency: string | null
  purchaser_name: string | null
  purchaser_email: string
  contact_id: string | null
  created_at: string
  internal_event_id: string
  internal_events?: {
    name?: string | null
    start_at?: string | null
  } | null
}

function daysForRange(key: TicketingReportRangeKey) {
  switch (key) {
    case "7d":
      return 7
    case "90d":
      return 90
    case "1y":
      return 365
    case "30d":
    default:
      return 30
  }
}

export function parseTicketingReportRangeKey(
  value: string | undefined | null
): TicketingReportRangeKey {
  if (value === "7d" || value === "90d" || value === "1y" || value === "30d") {
    return value
  }
  return "30d"
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDateLabel(dateKey: string) {
  const parsed = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return dateKey
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null
  }
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function resolveRange(rangeKey: TicketingReportRangeKey) {
  const days = daysForRange(rangeKey)
  const rangeEnd = endOfDay(new Date())
  const rangeStart = startOfDay(new Date())
  rangeStart.setDate(rangeStart.getDate() - (days - 1))

  const previousEnd = endOfDay(new Date(rangeStart))
  previousEnd.setDate(previousEnd.getDate() - 1)
  const previousStart = startOfDay(new Date(previousEnd))
  previousStart.setDate(previousStart.getDate() - (days - 1))

  return { rangeStart, rangeEnd, previousStart, previousEnd }
}

function unwrapEvent(row: OrderRow) {
  const event = Array.isArray(row.internal_events)
    ? row.internal_events[0]
    : row.internal_events
  return event || null
}

async function loadOrdersInWindow(
  organizationId: string,
  start: Date,
  end: Date
): Promise<OrderRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("ticket_orders")
    .select(
      `
      id,
      status,
      total_cents,
      refunded_amount_cents,
      currency,
      purchaser_name,
      purchaser_email,
      contact_id,
      created_at,
      internal_event_id,
      internal_events:internal_event_id (
        name,
        start_at
      )
    `
    )
    .eq("organization_id", organizationId)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .order("created_at", { ascending: true })

  if (error) {
    if (error.code === "42P01") return []
    if (error.code === "42703") {
      const fallback = await supabase
        .from("ticket_orders")
        .select(
          `
          id,
          status,
          total_cents,
          currency,
          purchaser_name,
          purchaser_email,
          contact_id,
          created_at,
          internal_event_id,
          internal_events:internal_event_id (
            name,
            start_at
          )
        `
        )
        .eq("organization_id", organizationId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: true })
      if (fallback.error) {
        if (fallback.error.code === "42P01") return []
        console.error(fallback.error)
        throw new Error("Failed to load ticket orders for reports")
      }
      return (fallback.data || []) as OrderRow[]
    }
    console.error(error)
    throw new Error("Failed to load ticket orders for reports")
  }

  return (data || []) as OrderRow[]
}

async function loadTicketCountsByOrder(
  organizationId: string,
  orderIds: string[]
) {
  const counts = new Map<string, number>()
  if (orderIds.length === 0) return counts

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tickets")
    .select("ticket_order_id")
    .eq("organization_id", organizationId)
    .in("ticket_order_id", orderIds)
    .in("status", [...TICKET_STATUSES])

  if (error) {
    if (error.code === "42P01") return counts
    console.error(error)
    return counts
  }

  for (const row of data || []) {
    const orderId = row.ticket_order_id as string
    counts.set(orderId, (counts.get(orderId) || 0) + 1)
  }

  return counts
}

async function loadEventCapacity(
  organizationId: string,
  eventIds: string[]
) {
  const capacityByEvent = new Map<string, number | null>()
  if (eventIds.length === 0) return capacityByEvent

  for (const eventId of eventIds) {
    capacityByEvent.set(eventId, 0)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("event_ticket_types")
    .select("internal_event_id, quantity_total, is_active")
    .eq("organization_id", organizationId)
    .in("internal_event_id", eventIds)

  if (error) {
    if (error.code === "42P01") return capacityByEvent
    console.error(error)
    return capacityByEvent
  }

  for (const row of data || []) {
    if (row.is_active === false) continue
    const eventId = row.internal_event_id as string
    const current = capacityByEvent.get(eventId)
    if (current === undefined) continue

    if (row.quantity_total == null) {
      capacityByEvent.set(eventId, null)
    } else if (current !== null) {
      capacityByEvent.set(eventId, current + Number(row.quantity_total || 0))
    }
  }

  return capacityByEvent
}

function orderRefundInput(order: OrderRow) {
  return {
    status: order.status,
    totalCents: Number(order.total_cents || 0),
    refundedAmountCents: Number(order.refunded_amount_cents || 0),
  }
}

function isCollectedStatus(status: string) {
  return COLLECTED_STATUSES.includes(status as (typeof COLLECTED_STATUSES)[number])
}

function isRevenueStatus(status: string) {
  return REVENUE_STATUSES.includes(status as (typeof REVENUE_STATUSES)[number])
}

function summarizeWindow(
  orders: OrderRow[],
  ticketCounts: Map<string, number>
) {
  let grossSalesCents = 0
  let refundsCents = 0
  let revenueOrders = 0
  let ticketsSold = 0
  const customers = new Set<string>()
  let currency = "USD"

  for (const order of orders) {
    const money = orderRefundInput(order)
    currency = order.currency || currency

    if (isCollectedStatus(order.status)) {
      grossSalesCents += money.totalCents
      refundsCents += ticketOrderRefundedCents(money)
    }

    if (isRevenueStatus(order.status)) {
      revenueOrders += 1
      ticketsSold += ticketCounts.get(order.id) || 0
      const customerKey =
        order.contact_id ||
        order.purchaser_email.trim().toLowerCase() ||
        order.id
      customers.add(customerKey)
    }
  }

  const netSalesCents = Math.max(grossSalesCents - refundsCents, 0)
  const avgOrderValueCents =
    revenueOrders > 0 ? Math.round(netSalesCents / revenueOrders) : 0

  return {
    grossSalesCents,
    refundsCents,
    netSalesCents,
    revenueOrders,
    ticketsSold,
    uniqueCustomers: customers.size,
    avgOrderValueCents,
    currency,
  }
}

function buildSalesByDay(
  rangeStart: Date,
  rangeEnd: Date,
  orders: OrderRow[],
  ticketCounts: Map<string, number>
): TicketingReportSalesRow[] {
  const byDay = new Map<
    string,
    {
      orders: number
      tickets: number
      grossSalesCents: number
      refundsCents: number
    }
  >()

  const cursor = startOfDay(rangeStart)
  const end = startOfDay(rangeEnd)
  while (cursor <= end) {
    const key = toDateKey(cursor)
    byDay.set(key, {
      orders: 0,
      tickets: 0,
      grossSalesCents: 0,
      refundsCents: 0,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  for (const order of orders) {
    const key = toDateKey(new Date(order.created_at))
    const bucket = byDay.get(key)
    if (!bucket) continue

    const money = orderRefundInput(order)
    if (isRevenueStatus(order.status)) {
      bucket.orders += 1
      bucket.tickets += ticketCounts.get(order.id) || 0
    }
    if (isCollectedStatus(order.status)) {
      bucket.grossSalesCents += money.totalCents
      bucket.refundsCents += ticketOrderRefundedCents(money)
    }
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, row]) => ({
      dateKey,
      dateLabel: formatDateLabel(dateKey),
      orders: row.orders,
      tickets: row.tickets,
      grossSalesCents: row.grossSalesCents,
      refundsCents: row.refundsCents,
      netSalesCents: Math.max(row.grossSalesCents - row.refundsCents, 0),
    }))
}

function buildEventRows(
  orders: OrderRow[],
  ticketCounts: Map<string, number>,
  capacityByEvent: Map<string, number | null>
): TicketingReportEventRow[] {
  const byEvent = new Map<
    string,
    {
      eventName: string
      eventStartAt: string | null
      ticketsSold: number
      revenueCents: number
      currency: string
    }
  >()

  for (const order of orders) {
    if (!isRevenueStatus(order.status)) {
      continue
    }

    const event = unwrapEvent(order)
    const current = byEvent.get(order.internal_event_id) || {
      eventName: event?.name || "Unknown event",
      eventStartAt: event?.start_at ?? null,
      ticketsSold: 0,
      revenueCents: 0,
      currency: order.currency || "USD",
    }

    current.ticketsSold += ticketCounts.get(order.id) || 0
    current.revenueCents += ticketOrderNetRevenueCents(orderRefundInput(order))
    current.currency = order.currency || current.currency
    byEvent.set(order.internal_event_id, current)
  }

  return Array.from(byEvent.entries())
    .map(([eventId, row]) => {
      const capacity = capacityByEvent.get(eventId) ?? null
      const fillRatePct =
        capacity != null && capacity > 0
          ? Math.round((row.ticketsSold / capacity) * 1000) / 10
          : null

      return {
        eventId,
        eventName: row.eventName,
        eventStartAt: row.eventStartAt,
        capacity,
        ticketsSold: row.ticketsSold,
        fillRatePct,
        revenueCents: row.revenueCents,
        currency: row.currency,
      }
    })
    .sort((a, b) => b.revenueCents - a.revenueCents)
}

function buildCustomerRows(
  orders: OrderRow[],
  ticketCounts: Map<string, number>
): TicketingReportCustomerRow[] {
  const byCustomer = new Map<
    string,
    {
      name: string
      email: string
      orders: number
      tickets: number
      totalSpentCents: number
      currency: string
    }
  >()

  for (const order of orders) {
    if (!isRevenueStatus(order.status)) {
      continue
    }

    const email = order.purchaser_email.trim().toLowerCase()
    const key = order.contact_id || email || order.id
    const current = byCustomer.get(key) || {
      name: order.purchaser_name?.trim() || email || "Customer",
      email: order.purchaser_email,
      orders: 0,
      tickets: 0,
      totalSpentCents: 0,
      currency: order.currency || "USD",
    }

    current.orders += 1
    current.tickets += ticketCounts.get(order.id) || 0
    current.totalSpentCents += ticketOrderNetRevenueCents(orderRefundInput(order))
    current.currency = order.currency || current.currency
    if (order.purchaser_name?.trim()) {
      current.name = order.purchaser_name.trim()
    }
    byCustomer.set(key, current)
  }

  return Array.from(byCustomer.entries())
    .map(([key, row]) => ({
      key,
      name: row.name,
      email: row.email,
      orders: row.orders,
      tickets: row.tickets,
      totalSpentCents: row.totalSpentCents,
      currency: row.currency,
    }))
    .sort((a, b) => b.totalSpentCents - a.totalSpentCents)
}

export async function getTicketingReports(
  rangeKey: TicketingReportRangeKey = "30d"
): Promise<TicketingReportsData> {
  const organizationId = await getSelectedOrganizationId()
  const { rangeStart, rangeEnd, previousStart, previousEnd } =
    resolveRange(rangeKey)

  const emptyOverview: TicketingReportOverview = {
    rangeKey,
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    totalSalesCents: 0,
    totalSalesChangePct: null,
    ticketsSold: 0,
    ticketsSoldChangePct: null,
    avgOrderValueCents: 0,
    avgOrderValueChangePct: null,
    uniqueCustomers: 0,
    uniqueCustomersChangePct: null,
    currency: "USD",
    topEvents: [],
  }

  if (!organizationId) {
    return {
      overview: emptyOverview,
      salesByDay: [],
      events: [],
      customers: [],
    }
  }

  const [currentOrders, previousOrders] = await Promise.all([
    loadOrdersInWindow(organizationId, rangeStart, rangeEnd),
    loadOrdersInWindow(organizationId, previousStart, previousEnd),
  ])

  const orderIds = [
    ...currentOrders.map((row) => row.id),
    ...previousOrders.map((row) => row.id),
  ]
  const ticketCounts = await loadTicketCountsByOrder(organizationId, orderIds)

  const currentSummary = summarizeWindow(currentOrders, ticketCounts)
  const previousSummary = summarizeWindow(previousOrders, ticketCounts)

  const eventIds = Array.from(
    new Set(currentOrders.map((row) => row.internal_event_id))
  )
  const capacityByEvent = await loadEventCapacity(organizationId, eventIds)
  const events = buildEventRows(currentOrders, ticketCounts, capacityByEvent)

  const overview: TicketingReportOverview = {
    rangeKey,
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    totalSalesCents: currentSummary.netSalesCents,
    totalSalesChangePct: percentChange(
      currentSummary.netSalesCents,
      previousSummary.netSalesCents
    ),
    ticketsSold: currentSummary.ticketsSold,
    ticketsSoldChangePct: percentChange(
      currentSummary.ticketsSold,
      previousSummary.ticketsSold
    ),
    avgOrderValueCents: currentSummary.avgOrderValueCents,
    avgOrderValueChangePct: percentChange(
      currentSummary.avgOrderValueCents,
      previousSummary.avgOrderValueCents
    ),
    uniqueCustomers: currentSummary.uniqueCustomers,
    uniqueCustomersChangePct: percentChange(
      currentSummary.uniqueCustomers,
      previousSummary.uniqueCustomers
    ),
    currency: currentSummary.currency,
    topEvents: events.slice(0, 10),
  }

  return {
    overview,
    salesByDay: buildSalesByDay(
      rangeStart,
      rangeEnd,
      currentOrders,
      ticketCounts
    ),
    events,
    customers: buildCustomerRows(currentOrders, ticketCounts).slice(0, 50),
  }
}

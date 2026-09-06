import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

import { sendEventOrderConfirmationEmail } from "@/lib/tickets/ticket-confirmation-email"
import { formatTicketPrice } from "@/lib/tickets/ticket-types"
import {
  nextTicketOrderRefundStatus,
  ticketOrderRefundedCents,
} from "@/lib/tickets/ticket-refund-math"
import { syncContactAffiliations } from "@/lib/contacts/contact-affiliation-sync"
import {
  loadOrganizationStripeConnect,
  stripeConnectRequestOptions,
} from "@/lib/stripe/stripe-connect-queries"
import { isOrganizationStripeConnectReady } from "@/lib/stripe/stripe-connect-types"
import {
  getAppBaseUrl,
  getStripeServerClient,
  isStripeConfigured,
} from "@/lib/stripe/stripe-server"

export type TicketStripeLine = {
  name: string
  quantity: number
  priceCents: number
}

export async function startTicketStripeCheckout(input: {
  supabase: SupabaseClient
  organizationId: string
  orgSlug: string
  eventId: string
  eventName: string
  orderId: string
  orderNumber: string
  purchaserEmail: string
  currency: string
  lines: TicketStripeLine[]
}): Promise<{ checkoutUrl: string } | { skipped: true; reason: string }> {
  const paidLines = input.lines.filter(
    (line) => line.quantity > 0 && line.priceCents > 0
  )
  if (paidLines.length === 0) {
    return { skipped: true, reason: "no_paid_lines" }
  }

  if (!isStripeConfigured()) {
    return { skipped: true, reason: "stripe_not_configured" }
  }

  let baseUrl: string
  try {
    baseUrl = getAppBaseUrl()
  } catch {
    return { skipped: true, reason: "app_url_missing" }
  }

  let connectedAccountId: string
  try {
    const status = await loadOrganizationStripeConnect(
      input.supabase,
      input.organizationId
    )
    if (!isOrganizationStripeConnectReady(status) || !status.stripeConnectAccountId) {
      return { skipped: true, reason: "connect_not_ready" }
    }
    connectedAccountId = status.stripeConnectAccountId
  } catch {
    return { skipped: true, reason: "connect_not_ready" }
  }

  const metadata = {
    manaratee_module: "ticketing",
    organization_id: input.organizationId,
    ticket_order_id: input.orderId,
    internal_event_id: input.eventId,
    order_number: input.orderNumber,
  }

  const successUrl = `${baseUrl}/customer/tickets?checkout=success&order=${encodeURIComponent(input.orderNumber)}`
  const cancelUrl = `${baseUrl}/customer/tickets?checkout=cancelled`

  const stripe = getStripeServerClient()
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: input.purchaserEmail,
      line_items: paidLines.map((line) => ({
        price_data: {
          currency: (input.currency || "usd").toLowerCase(),
          unit_amount: line.priceCents,
          product_data: {
            name: `${input.eventName} — ${line.name}`,
          },
        },
        quantity: line.quantity,
      })),
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      payment_intent_data: { metadata },
    },
    stripeConnectRequestOptions(connectedAccountId)
  )

  if (!session.url || !session.id) {
    return { skipped: true, reason: "no_checkout_url" }
  }

  const { error } = await input.supabase
    .from("ticket_orders")
    .update({
      stripe_checkout_session_id: session.id,
      payment_method: "Stripe",
      metadata: {
        source: "public",
        stripeCheckoutSessionId: session.id,
      },
    })
    .eq("id", input.orderId)
    .eq("organization_id", input.organizationId)

  if (error && (error.code === "42703" || error.message?.includes("stripe_checkout"))) {
    await input.supabase
      .from("ticket_orders")
      .update({
        payment_method: "Stripe",
        metadata: {
          source: "public",
          stripeCheckoutSessionId: session.id,
        },
      })
      .eq("id", input.orderId)
      .eq("organization_id", input.organizationId)
  } else if (error) {
    console.error("startTicketStripeCheckout update:", error.message)
    return { skipped: true, reason: "order_update_failed" }
  }

  return { checkoutUrl: session.url }
}

export async function completeTicketOrderFromStripeCheckout(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<{ handled: boolean; reason?: string; orderId?: string }> {
  const metadata = (session.metadata || {}) as Record<string, string>
  if (metadata.manaratee_module !== "ticketing") {
    return { handled: false, reason: "not_ticketing" }
  }

  const orderId = metadata.ticket_order_id?.trim()
  const organizationId = metadata.organization_id?.trim()
  if (!orderId || !organizationId) {
    return { handled: false, reason: "missing_order" }
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null

  const withStripe = await supabase
    .from("ticket_orders")
    .select(
      `
      id,
      status,
      order_number,
      purchaser_name,
      purchaser_email,
      internal_event_id,
      contact_id,
      total_cents,
      payment_method,
      metadata,
      stripe_checkout_session_id,
      stripe_payment_intent_id,
      internal_events:internal_event_id ( name, start_at, ticketing_config )
    `
    )
    .eq("id", orderId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const loaded =
    withStripe.error?.code === "42703"
      ? await supabase
          .from("ticket_orders")
          .select(
            `
        id,
        status,
        order_number,
        purchaser_name,
        purchaser_email,
        internal_event_id,
        contact_id,
        total_cents,
        payment_method,
        metadata,
        internal_events:internal_event_id ( name, start_at, ticketing_config )
      `
          )
          .eq("id", orderId)
          .eq("organization_id", organizationId)
          .maybeSingle()
      : withStripe

  const order = loaded.data as Record<string, unknown> | null
  const error = loaded.error

  if (error || !order) {
    return { handled: false, reason: "order_not_found" }
  }

  if (order.status === "completed") {
    return { handled: true, orderId: order.id as string }
  }

  if (order.status === "canceled" || order.status === "refunded") {
    try {
      await createStripeTicketRefund(supabase, {
        organizationId,
        order: mapTicketOrderStripeRefundRow(order, paymentIntentId),
      })
    } catch (refundError) {
      const message =
        refundError instanceof Error ? refundError.message : String(refundError)
      console.error(`[ticket-stripe] refund after canceled checkout: ${message}`)
    }
    return { handled: true, orderId: order.id as string, reason: "already_canceled" }
  }

  const updatePayload: Record<string, unknown> = {
    status: "completed",
    payment_method: "Stripe",
    payment_reference: session.id,
  }
  if (session.id) updatePayload.stripe_checkout_session_id = session.id
  if (paymentIntentId) updatePayload.stripe_payment_intent_id = paymentIntentId

  const { error: updateError } = await supabase
    .from("ticket_orders")
    .update(updatePayload)
    .eq("id", order.id)
    .eq("organization_id", organizationId)

  if (updateError && updateError.code !== "42703") {
    console.error("completeTicketOrderFromStripeCheckout:", updateError.message)
    return { handled: false, reason: "update_failed" }
  }

  if (updateError?.code === "42703") {
    await supabase
      .from("ticket_orders")
      .update({
        status: "completed",
        payment_method: "Stripe",
        payment_reference: session.id,
      })
      .eq("id", order.id)
      .eq("organization_id", organizationId)
  }

  const contactId = order.contact_id as string | null
  if (contactId) {
    try {
      await syncContactAffiliations(contactId, organizationId, supabase)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[ticket-stripe] affiliation sync failed: ${message}`)
    }
  }

  const { data: tickets } = await supabase
    .from("tickets")
    .select("ticket_code, attendee_name, event_ticket_types:ticket_type_id ( name )")
    .eq("ticket_order_id", order.id)
    .eq("organization_id", organizationId)

  const eventEmbed = Array.isArray(order.internal_events)
    ? order.internal_events[0]
    : order.internal_events
  const eventName = (eventEmbed?.name as string) || "Event"
  const startAtLabel = eventEmbed?.start_at
    ? new Date(eventEmbed.start_at as string).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null

  const purchaserEmail = (order.purchaser_email as string) || ""
  if (purchaserEmail) {
    const ticketingConfig =
      eventEmbed && typeof eventEmbed === "object"
        ? ((eventEmbed as { ticketing_config?: unknown }).ticketing_config as
            | { communications?: unknown }
            | null)
        : null
    await sendEventOrderConfirmationEmail({
      to: purchaserEmail,
      purchaserName: (order.purchaser_name as string) || "Guest",
      eventName,
      orderNumber: (order.order_number as string) || "",
      startAtLabel,
      kind: "confirmed",
      communications: ticketingConfig?.communications || null,
      lines: (tickets || []).map((row) => {
        const typeEmbed = Array.isArray(row.event_ticket_types)
          ? row.event_ticket_types[0]
          : row.event_ticket_types
        return {
          ticketCode: (row.ticket_code as string) || "",
          ticketTypeName: (typeEmbed?.name as string) || "Registration",
          attendeeName: (row.attendee_name as string) || "Guest",
        }
      }),
    })
  }

  return { handled: true, orderId: order.id as string }
}

export type TicketOrderStripeRefundRow = {
  id: string
  status: string
  total_cents: number | null
  refunded_amount_cents?: number | null
  payment_method: string | null
  stripe_checkout_session_id?: string | null
  stripe_payment_intent_id?: string | null
  metadata?: Record<string, unknown> | null
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function stringField(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function paymentIntentIdFromUnknown(
  value: string | Stripe.PaymentIntent | null | undefined
): string | null {
  if (!value) return null
  return typeof value === "string" ? value : value.id || null
}

function isStripeAlreadyRefundedError(error: unknown): boolean {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code: unknown }).code)
      : ""
  const message = error instanceof Error ? error.message : String(error)
  return code === "charge_already_refunded" || /already (been )?refunded/i.test(message)
}

function isTicketingStripeCharge(charge: Stripe.Charge): boolean {
  if (charge.metadata?.manaratee_module === "ticketing") return true
  const paymentIntent = charge.payment_intent
  if (paymentIntent && typeof paymentIntent !== "string") {
    return paymentIntent.metadata?.manaratee_module === "ticketing"
  }
  return false
}

function formatEventStartLabel(startAt: unknown): string | null {
  if (typeof startAt !== "string" || !startAt) return null
  const date = new Date(startAt)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function mapTicketOrderStripeRefundRow(
  order: Record<string, unknown>,
  paymentIntentId?: string | null
): TicketOrderStripeRefundRow {
  const metadata = asRecord(order.metadata)
  return {
    id: String(order.id),
    status: String(order.status || ""),
    total_cents: Number(order.total_cents || 0),
    refunded_amount_cents: Number(order.refunded_amount_cents || 0),
    payment_method: stringField(order.payment_method),
    stripe_checkout_session_id:
      stringField(order.stripe_checkout_session_id) ||
      stringField(metadata.stripeCheckoutSessionId),
    stripe_payment_intent_id:
      stringField(order.stripe_payment_intent_id) || paymentIntentId || null,
    metadata,
  }
}

function ticketOrderLooksLikeStripe(order: TicketOrderStripeRefundRow): boolean {
  const method = (order.payment_method || "").toLowerCase()
  return Boolean(
    order.stripe_payment_intent_id ||
      order.stripe_checkout_session_id ||
      method === "stripe"
  )
}

async function loadConnectedStripeAccountId(
  supabase: SupabaseClient,
  organizationId: string
): Promise<string | null> {
  if (!isStripeConfigured()) return null
  try {
    const status = await loadOrganizationStripeConnect(supabase, organizationId)
    if (!isOrganizationStripeConnectReady(status) || !status.stripeConnectAccountId) {
      return null
    }
    return status.stripeConnectAccountId
  } catch {
    return null
  }
}

const TICKET_ORDER_REFUND_SELECT = `
  id,
  organization_id,
  status,
  order_number,
  purchaser_name,
  purchaser_email,
  internal_event_id,
  total_cents,
  refunded_amount_cents,
  currency,
  payment_method,
  metadata,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
        internal_events:internal_event_id ( name, start_at, ticketing_config )
`

const TICKET_ORDER_REFUND_SELECT_FALLBACK = `
  id,
  organization_id,
  status,
  order_number,
  purchaser_name,
  purchaser_email,
  internal_event_id,
  total_cents,
  currency,
  payment_method,
  metadata,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
        internal_events:internal_event_id ( name, start_at, ticketing_config )
`

async function loadTicketOrderRefundRow(
  supabase: SupabaseClient,
  input: {
    orderId?: string
    organizationId?: string | null
    paymentIntentId?: string | null
  }
): Promise<{
  data: Record<string, unknown> | null
  error: { message?: string; code?: string } | null
}> {
  const run = async (columns: string) => {
    let query = supabase.from("ticket_orders").select(columns)
    if (input.orderId) query = query.eq("id", input.orderId)
    if (input.organizationId) query = query.eq("organization_id", input.organizationId)
    if (input.paymentIntentId) {
      query = query.eq("stripe_payment_intent_id", input.paymentIntentId)
    }
    return query.maybeSingle()
  }

  const normalize = (result: {
    data: unknown
    error: { message?: string; code?: string } | null
  }) => ({
    data:
      result.data && typeof result.data === "object" && !Array.isArray(result.data)
        ? (result.data as Record<string, unknown>)
        : null,
    error: result.error,
  })

  const withRefunded = await run(TICKET_ORDER_REFUND_SELECT)
  if (withRefunded.error?.code === "42703") {
    return normalize(await run(TICKET_ORDER_REFUND_SELECT_FALLBACK))
  }
  return normalize(withRefunded)
}

async function sendTicketOrderRefundEmail(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    kind: "refunded" | "partial_refund" | "canceled"
    refundAmountCents?: number
    currency?: string | null
    staffNote?: string | null
    ticketIds?: string[]
    order: {
      id: string
      order_number?: unknown
      purchaser_name?: unknown
      purchaser_email?: unknown
      internal_events?: unknown
    }
  }
) {
  const purchaserEmail = stringField(input.order.purchaser_email)
  if (!purchaserEmail) return { sent: false }

  let ticketsQuery = supabase
    .from("tickets")
    .select("id, ticket_code, attendee_name, event_ticket_types:ticket_type_id ( name )")
    .eq("ticket_order_id", input.order.id)
    .eq("organization_id", input.organizationId)

  if (input.ticketIds && input.ticketIds.length > 0) {
    ticketsQuery = ticketsQuery.in("id", input.ticketIds)
  }

  const { data: tickets } = await ticketsQuery

  const eventEmbed = Array.isArray(input.order.internal_events)
    ? input.order.internal_events[0]
    : input.order.internal_events
  const eventRecord =
    eventEmbed && typeof eventEmbed === "object"
      ? (eventEmbed as { name?: unknown; start_at?: unknown })
      : null

  await sendEventOrderConfirmationEmail({
    to: purchaserEmail,
    purchaserName: stringField(input.order.purchaser_name) || "Guest",
    eventName: stringField(eventRecord?.name) || "Event",
    orderNumber: stringField(input.order.order_number) || "",
    startAtLabel: formatEventStartLabel(eventRecord?.start_at),
    kind: input.kind,
    refundAmountLabel:
      input.refundAmountCents && input.refundAmountCents > 0
        ? formatTicketPrice(input.refundAmountCents, input.currency || "USD")
        : null,
    staffNote: input.staffNote,
    lines: (tickets || []).map((row) => {
      const typeEmbed = Array.isArray(row.event_ticket_types)
        ? row.event_ticket_types[0]
        : row.event_ticket_types
      return {
        ticketCode: (row.ticket_code as string) || "",
        ticketTypeName: (typeEmbed?.name as string) || "Registration",
        attendeeName: (row.attendee_name as string) || "Guest",
      }
    }),
  })

  return { sent: true }
}

export async function expirePendingTicketCheckoutSession(
  supabase: SupabaseClient,
  input: { organizationId: string; checkoutSessionId: string }
): Promise<void> {
  const connectedAccountId = await loadConnectedStripeAccountId(
    supabase,
    input.organizationId
  )
  if (!connectedAccountId) return

  const stripe = getStripeServerClient()
  try {
    await stripe.checkout.sessions.expire(
      input.checkoutSessionId,
      {},
      stripeConnectRequestOptions(connectedAccountId)
    )
  } catch {
    // Already expired, completed, or not found.
  }
}

export async function createStripeTicketRefund(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    order: TicketOrderStripeRefundRow
    amountCents?: number
  }
): Promise<{ refundId?: string; skipped?: boolean; alreadyRefunded?: boolean }> {
  const totalCents = Math.max(Number(input.order.total_cents || 0), 0)
  const alreadyRefunded = ticketOrderRefundedCents({
    status: input.order.status,
    totalCents,
    refundedAmountCents: input.order.refunded_amount_cents,
  })
  const remainingCents = Math.max(totalCents - alreadyRefunded, 0)
  const amountCents =
    input.amountCents == null ? remainingCents : Math.round(input.amountCents)

  if (totalCents <= 0 || remainingCents <= 0 || !ticketOrderLooksLikeStripe(input.order)) {
    return { skipped: true }
  }
  if (amountCents <= 0) {
    return { skipped: true }
  }
  if (amountCents > remainingCents) {
    throw new Error("Refund amount is greater than the remaining paid balance.")
  }

  const connectedAccountId = await loadConnectedStripeAccountId(
    supabase,
    input.organizationId
  )
  if (!connectedAccountId) {
    throw new Error(
      "Stripe Connect is not ready. Refund this charge in Stripe, or reconnect Online Payments and try again."
    )
  }

  const stripe = getStripeServerClient()
  const requestOptions = stripeConnectRequestOptions(connectedAccountId)
  let paymentIntentId = input.order.stripe_payment_intent_id || null
  const checkoutSessionId = input.order.stripe_checkout_session_id || null

  if (!paymentIntentId && checkoutSessionId) {
    const session = await stripe.checkout.sessions.retrieve(
      checkoutSessionId,
      {},
      requestOptions
    )
    paymentIntentId = paymentIntentIdFromUnknown(session.payment_intent)
    if (paymentIntentId) {
      const persistPayload: Record<string, unknown> = {
        stripe_payment_intent_id: paymentIntentId,
      }
      const { error } = await supabase
        .from("ticket_orders")
        .update(persistPayload)
        .eq("id", input.order.id)
        .eq("organization_id", input.organizationId)
      if (error && error.code !== "42703") {
        console.error("createStripeTicketRefund persist PI:", error.message)
      }
    }
  }

  if (!paymentIntentId) {
    throw new Error(
      "This Stripe order has no payment intent on file. Refund the charge in Stripe Dashboard, then try again."
    )
  }

  const metadata = {
    manaratee_module: "ticketing",
    manaratee_refund: "ticketing",
    organization_id: input.organizationId,
    ticket_order_id: input.order.id,
  }

  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: amountCents,
        reason: "requested_by_customer",
        metadata,
      },
      requestOptions
    )
    return { refundId: refund.id }
  } catch (error) {
    if (isStripeAlreadyRefundedError(error)) {
      return { alreadyRefunded: true }
    }
    throw error
  }
}

const ACTIVE_TICKET_STATUSES = ["valid", "checked_in", "waitlisted"] as const

async function voidTicketOrderSeats(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    orderId: string
    ticketStatus: "refunded" | "canceled"
    ticketIds?: string[]
  }
) {
  let query = supabase
    .from("tickets")
    .select("id, ticket_type_id, status")
    .eq("organization_id", input.organizationId)
    .eq("ticket_order_id", input.orderId)
    .in("status", [...ACTIVE_TICKET_STATUSES])

  if (input.ticketIds && input.ticketIds.length > 0) {
    query = query.in("id", input.ticketIds)
  }

  const { data: tickets, error: ticketsError } = await query
  if (ticketsError) {
    throw new Error(ticketsError.message || "Could not load tickets.")
  }
  if (!tickets?.length) return

  const ticketIds = tickets.map((ticket) => ticket.id as string)
  const { error: ticketUpdateError } = await supabase
    .from("tickets")
    .update({ status: input.ticketStatus })
    .eq("organization_id", input.organizationId)
    .eq("ticket_order_id", input.orderId)
    .in("id", ticketIds)
    .in("status", [...ACTIVE_TICKET_STATUSES])

  if (ticketUpdateError) {
    throw new Error(ticketUpdateError.message || "Could not update tickets.")
  }

  const countsByType = new Map<string, number>()
  for (const ticket of tickets) {
    if (ticket.status === "waitlisted") continue
    const typeId = ticket.ticket_type_id as string
    countsByType.set(typeId, (countsByType.get(typeId) || 0) + 1)
  }

  for (const [typeId, count] of countsByType) {
    const { data: ticketType, error: typeError } = await supabase
      .from("event_ticket_types")
      .select("quantity_sold")
      .eq("id", typeId)
      .eq("organization_id", input.organizationId)
      .maybeSingle()

    if (typeError || !ticketType) continue

    const nextSold = Math.max(Number(ticketType.quantity_sold || 0) - count, 0)
    await supabase
      .from("event_ticket_types")
      .update({ quantity_sold: nextSold })
      .eq("id", typeId)
      .eq("organization_id", input.organizationId)
  }
}

export async function applyTicketOrderRefundInDatabase(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    orderId: string
    nextOrderStatus: "refunded" | "partially_refunded" | "canceled"
    refundedAmountCents?: number
    thisRefundCents?: number
    stripeRefundId?: string | null
    ticketIdsToVoid?: string[]
    notifyCustomer?: boolean
    staffNote?: string | null
  }
): Promise<{ applied: boolean; alreadyFinal: boolean; eventId?: string | null }> {
  const { data: order, error } = await loadTicketOrderRefundRow(supabase, {
    orderId: input.orderId,
    organizationId: input.organizationId,
  })

  if (error || !order) {
    throw new Error(error?.message || "Order not found.")
  }

  const currentStatus = String(order.status || "")
  if (currentStatus === "canceled" || currentStatus === "refunded") {
    return { applied: false, alreadyFinal: true, eventId: order.internal_event_id as string }
  }

  const totalCents = Number(order.total_cents || 0)
  const alreadyRefunded = ticketOrderRefundedCents({
    status: currentStatus,
    totalCents,
    refundedAmountCents: Number(order.refunded_amount_cents || 0),
  })
  const nextRefunded =
    input.refundedAmountCents == null
      ? input.nextOrderStatus === "refunded"
        ? totalCents
        : alreadyRefunded
      : Math.max(Number(input.refundedAmountCents), alreadyRefunded)

  if (
    input.nextOrderStatus === "partially_refunded" &&
    nextRefunded <= alreadyRefunded &&
    !(input.ticketIdsToVoid && input.ticketIdsToVoid.length > 0)
  ) {
    return { applied: false, alreadyFinal: true, eventId: order.internal_event_id as string }
  }

  const staffNote = input.staffNote?.trim() || null
  const metadata = {
    ...asRecord(order.metadata),
    refunded_at: new Date().toISOString(),
    ...(input.stripeRefundId ? { stripeRefundId: input.stripeRefundId } : {}),
    ...(staffNote ? { staff_refund_note: staffNote } : {}),
  }

  const updatePayload: Record<string, unknown> = {
    status: input.nextOrderStatus,
    metadata,
    refunded_amount_cents: nextRefunded,
  }

  const { error: orderError } = await supabase
    .from("ticket_orders")
    .update(updatePayload)
    .eq("id", input.orderId)
    .eq("organization_id", input.organizationId)

  if (orderError && orderError.code === "42703") {
    const { error: fallbackError } = await supabase
      .from("ticket_orders")
      .update({
        status: input.nextOrderStatus,
        metadata,
      })
      .eq("id", input.orderId)
      .eq("organization_id", input.organizationId)
    if (fallbackError) {
      throw new Error(fallbackError.message || "Could not update order.")
    }
  } else if (orderError) {
    throw new Error(orderError.message || "Could not update order.")
  }

  const cancelAllRemaining =
    input.nextOrderStatus === "refunded" || input.nextOrderStatus === "canceled"
  const ticketStatus =
    input.nextOrderStatus === "canceled" ? "canceled" : "refunded"
  if (cancelAllRemaining || (input.ticketIdsToVoid && input.ticketIdsToVoid.length > 0)) {
    await voidTicketOrderSeats(supabase, {
      organizationId: input.organizationId,
      orderId: input.orderId,
      ticketStatus,
      ticketIds: cancelAllRemaining ? undefined : input.ticketIdsToVoid,
    })
  }

  const thisRefundCents =
    input.thisRefundCents ?? Math.max(nextRefunded - alreadyRefunded, 0)
  const shouldEmail = input.notifyCustomer !== false
  if (shouldEmail) {
    const emailKind =
      input.nextOrderStatus === "canceled"
        ? "canceled"
        : input.nextOrderStatus === "partially_refunded"
          ? "partial_refund"
          : "refunded"
    if (
      emailKind === "canceled" ||
      thisRefundCents > 0 ||
      (input.ticketIdsToVoid && input.ticketIdsToVoid.length > 0)
    ) {
      await sendTicketOrderRefundEmail(supabase, {
        organizationId: input.organizationId,
        kind: emailKind,
        refundAmountCents: thisRefundCents,
        currency: stringField(order.currency) || "USD",
        staffNote,
        ticketIds: input.ticketIdsToVoid,
        order: {
          id: order.id as string,
          order_number: order.order_number,
          purchaser_name: order.purchaser_name,
          purchaser_email: order.purchaser_email,
          internal_events: order.internal_events,
        },
      })
    }
  }

  return {
    applied: true,
    alreadyFinal: false,
    eventId: (order.internal_event_id as string) || null,
  }
}

export async function completeTicketOrderRefundFromStripeCharge(
  supabase: SupabaseClient,
  charge: Stripe.Charge
): Promise<{ handled: boolean; orderId?: string; skipped?: string }> {
  const paymentIntentId = paymentIntentIdFromUnknown(charge.payment_intent)
  const metadataOrderId = stringField(charge.metadata?.ticket_order_id)
  const metadataOrganizationId = stringField(charge.metadata?.organization_id)
  const ticketingCharge = isTicketingStripeCharge(charge)

  let order: Record<string, unknown> | null = null

  if (metadataOrderId) {
    const { data, error } = await loadTicketOrderRefundRow(supabase, {
      orderId: metadataOrderId,
      organizationId: metadataOrganizationId,
    })
    if (error && error.code === "42703") {
      return ticketingCharge
        ? { handled: true, skipped: "missing_stripe_columns" }
        : { handled: false }
    }
    if (!error && data) {
      order = data
    }
  }

  if (!order && paymentIntentId) {
    const { data, error } = await loadTicketOrderRefundRow(supabase, {
      paymentIntentId,
      organizationId: metadataOrganizationId,
    })
    if (error && error.code === "42703") {
      return ticketingCharge
        ? { handled: true, skipped: "missing_stripe_columns" }
        : { handled: false }
    }
    if (!error && data) {
      order = data
    }
  }

  if (!order) {
    return ticketingCharge ? { handled: true, skipped: "order_not_found" } : { handled: false }
  }

  const organizationId =
    stringField(order.organization_id) || metadataOrganizationId
  if (!organizationId) {
    return { handled: true, orderId: String(order.id), skipped: "missing_org" }
  }

  const totalCents = Number(order.total_cents || 0)
  const alreadyRefunded = ticketOrderRefundedCents({
    status: String(order.status || ""),
    totalCents,
    refundedAmountCents: Number(order.refunded_amount_cents || 0),
  })
  const stripeRefundedCents = Math.max(Number(charge.amount_refunded || 0), 0)
  const nextRefunded = Math.min(Math.max(stripeRefundedCents, alreadyRefunded), totalCents)
  const nextStatus = nextTicketOrderRefundStatus(totalCents, nextRefunded)
  const currentStatus = String(order.status || "")
  if (nextStatus === "completed") {
    return { handled: true, orderId: String(order.id), skipped: "no_refund_amount" }
  }
  if (stripeRefundedCents <= alreadyRefunded && currentStatus === nextStatus) {
    return { handled: true, orderId: String(order.id), skipped: "already_applied" }
  }
  if (currentStatus === "refunded") {
    return { handled: true, orderId: String(order.id), skipped: "already_applied" }
  }

  await applyTicketOrderRefundInDatabase(supabase, {
    organizationId,
    orderId: String(order.id),
    nextOrderStatus: nextStatus,
    refundedAmountCents: nextRefunded,
    thisRefundCents: Math.max(nextRefunded - alreadyRefunded, 0),
    stripeRefundId: charge.refunds?.data?.[0]?.id || null,
  })

  return { handled: true, orderId: String(order.id) }
}

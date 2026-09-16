"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

import { syncContactAffiliations } from "@/lib/contacts/contact-affiliation-sync"
import { createClient } from "@/lib/supabase/server"
import { findOrCreateContact } from "@/lib/contacts/contact-actions"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { hasEventCheckInPermission } from "@/lib/events/event-access"
import { revalidateTicketingPaths } from "@/lib/tickets/revalidate-ticketing-paths"
import { resolveEventWorkspaceFeatures } from "@/lib/events/event-workspace-features"
import { sendEventOrderConfirmationEmail } from "@/lib/tickets/ticket-confirmation-email"
import {
  applyTicketOrderRefundInDatabase,
  createStripeTicketRefund,
  expirePendingTicketCheckoutSession,
  startTicketStripeCheckout,
} from "@/lib/tickets/ticket-stripe"
import {
  nextTicketOrderRefundStatus,
  ticketOrderRefundedCents,
} from "@/lib/tickets/ticket-refund-math"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { getJoinOrganizationBySlug } from "@/lib/organizations/join-organization-actions"
import {
  getTicketOfferingSaleStatus,
  type EventTicketingConfig,
  type TicketingSalesStatus,
} from "./ticket-types"
import type { TicketOrderStatus } from "./ticket-order-queries"

type CreateTicketOrderLine = {
  ticketTypeId: string
  quantity: number
}

export type CreateTicketOrderInput = {
  internalEventId: string
  purchaserName: string
  purchaserEmail: string
  paymentMethod?: string | null
  paymentReference?: string | null
  status?: TicketOrderStatus
  lines: CreateTicketOrderLine[]
  /** When true, reject lines for offerings outside their sales window (public checkout). */
  enforceSaleWindows?: boolean
}

function generateOrderNumber() {
  const stamp = Date.now().toString().slice(-8)
  const random = Math.floor(Math.random() * 900 + 100)
  return `${stamp}${random}`
}

function generateTicketCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let index = 0; index < 8; index += 1) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

async function assertTicketingManagePermission() {
  const canManage = await hasAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE,
    PERMISSIONS.TICKETING_MANAGE
  )
  if (!canManage) {
    throw new Error("You do not have permission to manage ticket orders.")
  }
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function asTicketOrderMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

type TicketOrderContactRow = {
  id: string
  contact_id: string | null
  purchaser_name: string | null
  purchaser_email: string
  status: string
}

async function ensureOrderContactId(
  supabase: SupabaseClient,
  organizationId: string,
  order: TicketOrderContactRow
): Promise<string | null> {
  if (order.contact_id) {
    return order.contact_id
  }

  const cleanEmail = order.purchaser_email?.trim().toLowerCase()
  if (!cleanEmail) {
    return null
  }

  const cleanName = order.purchaser_name?.trim() || cleanEmail
  const { contactId } = await findOrCreateContact({
    organizationId,
    fullName: cleanName,
    email: cleanEmail,
  })

  const { error } = await supabase
    .from("ticket_orders")
    .update({ contact_id: contactId })
    .eq("id", order.id)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Could not link order to contact")
  }

  return contactId
}

async function syncEventAttendeeAffiliationForContact(
  supabase: SupabaseClient,
  organizationId: string,
  contactId: string,
  context: string,
  options?: { throwOnFailure?: boolean }
): Promise<void> {
  try {
    await syncContactAffiliations(contactId, organizationId, supabase)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[ticket-order] affiliation sync failed (${context}, contact ${contactId}): ${message}`)
    if (options?.throwOnFailure) {
      throw error instanceof Error ? error : new Error(message)
    }
  }
}

async function handleCompletedOrderAffiliationSync(
  supabase: SupabaseClient,
  organizationId: string,
  orderId: string,
  options?: { throwOnFailure?: boolean }
): Promise<void> {
  const { data: order, error } = await supabase
    .from("ticket_orders")
    .select("id, contact_id, purchaser_name, purchaser_email, status")
    .eq("id", orderId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    const message = error.message || "Could not load order for affiliation sync"
    console.error(`[ticket-order] affiliation sync skipped (order ${orderId}): ${message}`)
    if (options?.throwOnFailure) {
      throw new Error(message)
    }
    return
  }

  if (!order || order.status !== "completed") {
    return
  }

  let contactId: string | null = null
  try {
    contactId = await ensureOrderContactId(
      supabase,
      organizationId,
      order as TicketOrderContactRow
    )
  } catch (linkError) {
    const message = linkError instanceof Error ? linkError.message : String(linkError)
    console.error(`[ticket-order] affiliation sync skipped (order ${orderId}): ${message}`)
    if (options?.throwOnFailure) {
      throw linkError instanceof Error ? linkError : new Error(message)
    }
    return
  }

  if (!contactId) {
    console.error(
      `[ticket-order] affiliation sync skipped (order ${orderId}): missing contact_id and purchaser_email`
    )
    return
  }

  await syncEventAttendeeAffiliationForContact(
    supabase,
    organizationId,
    contactId,
    `order ${orderId}`,
    options
  )
}

export async function updateEventTicketingSalesStatus(
  internalEventId: string,
  salesStatus: TicketingSalesStatus
) {
  await assertTicketingManagePermission()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: event, error: loadError } = await supabase
    .from("internal_events")
    .select("id, ticketing_config")
    .eq("id", internalEventId)
    .eq("organization_id", organizationId)
    .eq("requires_ticketing", true)
    .maybeSingle()

  if (loadError || !event) {
    throw new Error("Ticketed event not found")
  }

  const config = (event.ticketing_config as Record<string, unknown>) || {}

  const { error } = await supabase
    .from("internal_events")
    .update({
      ticketing_config: {
        ...config,
        salesStatus,
      },
    })
    .eq("id", internalEventId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Could not update sales status")
  }

  revalidateTicketingPaths()
  revalidatePath(`/event-management/${internalEventId}`)
}

export async function createTicketOrder(input: CreateTicketOrderInput) {
  await assertTicketingManagePermission()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const cleanEmail = input.purchaserEmail.trim().toLowerCase()
  const cleanName = input.purchaserName.trim()

  if (!cleanName) throw new Error("Purchaser name is required")
  if (!cleanEmail) throw new Error("Purchaser email is required")

  const lines = input.lines.filter((line) => line.quantity > 0)
  if (lines.length === 0) {
    throw new Error("Add at least one ticket line.")
  }

  const { data: event, error: eventError } = await supabase
    .from("internal_events")
    .select("id, name, ticketing_config, workspace_features, requires_ticketing")
    .eq("id", input.internalEventId)
    .eq("organization_id", organizationId)
    .eq("requires_ticketing", true)
    .maybeSingle()

  if (eventError || !event) {
    throw new Error("Ticketed event not found")
  }

  const waitlistEnabled = resolveEventWorkspaceFeatures(event).waitlist
  const eventConfig = (event.ticketing_config || {}) as Record<string, unknown>

  const typeIds = lines.map((line) => line.ticketTypeId)
  const { data: ticketTypes, error: typesError } = await supabase
    .from("event_ticket_types")
    .select(
      "id, name, price_cents, quantity_total, quantity_sold, is_active, sales_start_at, sales_end_at, visibility, min_per_order, max_per_order"
    )
    .eq("organization_id", organizationId)
    .eq("internal_event_id", input.internalEventId)
    .in("id", typeIds)

  if (typesError) {
    throw new Error(typesError.message || "Could not load ticket types")
  }

  const typeMap = new Map((ticketTypes || []).map((row) => [row.id as string, row]))
  const pendingValidByType = new Map<string, number>()
  let subtotalCents = 0
  const resolvedLines: Array<{
    ticketTypeId: string
    quantity: number
    validQuantity: number
    waitlistQuantity: number
    priceCents: number
    name: string
  }> = []

  for (const line of lines) {
    const ticketType = typeMap.get(line.ticketTypeId)
    if (!ticketType || ticketType.is_active === false) {
      throw new Error("One or more ticket types are invalid.")
    }

    if (input.enforceSaleWindows) {
      const visibility = (ticketType.visibility as string | null) || "public"
      if (visibility === "private") {
        throw new Error(`"${ticketType.name as string}" is not available for public registration.`)
      }

      const saleStatus = getTicketOfferingSaleStatus({
        eventConfig: eventConfig as EventTicketingConfig,
        offeringSalesStartAt: ticketType.sales_start_at as string | null,
        offeringSalesEndAt: ticketType.sales_end_at as string | null,
      })
      if (!saleStatus.onSale) {
        throw new Error(
          saleStatus.reason ||
            `"${ticketType.name as string}" is not available for registration right now.`
        )
      }

      const minPerOrder = Math.max(1, Number(ticketType.min_per_order || 1))
      const maxPerOrder =
        ticketType.max_per_order != null ? Number(ticketType.max_per_order) : null
      if (line.quantity < minPerOrder) {
        throw new Error(
          `"${ticketType.name as string}" requires at least ${minPerOrder} per order.`
        )
      }
      if (maxPerOrder != null && line.quantity > maxPerOrder) {
        throw new Error(
          `"${ticketType.name as string}" is limited to ${maxPerOrder} per order.`
        )
      }
    }

    const pendingValid = pendingValidByType.get(line.ticketTypeId) || 0
    const sold = Number(ticketType.quantity_sold || 0) + pendingValid
    const total = ticketType.quantity_total
    let validQuantity = line.quantity
    let waitlistQuantity = 0

    if (total != null) {
      const available = Math.max(0, total - sold)
      validQuantity = Math.min(line.quantity, available)
      waitlistQuantity = line.quantity - validQuantity
    }

    if (waitlistQuantity > 0 && !waitlistEnabled) {
      throw new Error(`Not enough "${ticketType.name}" tickets remaining.`)
    }

    pendingValidByType.set(line.ticketTypeId, pendingValid + validQuantity)

    const priceCents = Number(ticketType.price_cents || 0)
    subtotalCents += priceCents * validQuantity
    resolvedLines.push({
      ticketTypeId: line.ticketTypeId,
      quantity: line.quantity,
      validQuantity,
      waitlistQuantity,
      priceCents,
      name: ticketType.name as string,
    })
  }

  const currency =
    ((event.ticketing_config as Record<string, unknown>)?.currency as string) || "USD"
  const status = input.status || "completed"

  const { contactId } = await findOrCreateContact({
    organizationId,
    fullName: cleanName,
    email: cleanEmail,
  })

  const { data: order, error: orderError } = await supabase
    .from("ticket_orders")
    .insert({
      organization_id: organizationId,
      internal_event_id: input.internalEventId,
      contact_id: contactId,
      order_number: generateOrderNumber(),
      status,
      subtotal_cents: subtotalCents,
      discount_cents: 0,
      total_cents: subtotalCents,
      currency,
      payment_method: input.paymentMethod?.trim() || null,
      payment_reference: input.paymentReference?.trim() || null,
      purchaser_name: cleanName,
      purchaser_email: cleanEmail,
    })
    .select("id, order_number")
    .single()

  if (orderError || !order) {
    throw new Error(orderError?.message || "Could not create order")
  }

  const ticketRows: Array<Record<string, unknown>> = []

  for (const line of resolvedLines) {
    for (let index = 0; index < line.validQuantity; index += 1) {
      ticketRows.push({
        organization_id: organizationId,
        ticket_order_id: order.id,
        ticket_type_id: line.ticketTypeId,
        internal_event_id: input.internalEventId,
        ticket_code: generateTicketCode(),
        attendee_name: cleanName,
        attendee_email: cleanEmail,
        status: "valid",
      })
    }

    for (let index = 0; index < line.waitlistQuantity; index += 1) {
      ticketRows.push({
        organization_id: organizationId,
        ticket_order_id: order.id,
        ticket_type_id: line.ticketTypeId,
        internal_event_id: input.internalEventId,
        ticket_code: generateTicketCode(),
        attendee_name: cleanName,
        attendee_email: cleanEmail,
        status: "waitlisted",
      })
    }

    if (line.validQuantity <= 0) continue

    const ticketType = typeMap.get(line.ticketTypeId)!
    const { error: updateTypeError } = await supabase
      .from("event_ticket_types")
      .update({
        quantity_sold: Number(ticketType.quantity_sold || 0) + line.validQuantity,
      })
      .eq("id", line.ticketTypeId)
      .eq("organization_id", organizationId)

    if (updateTypeError) {
      throw new Error(updateTypeError.message || "Could not update ticket inventory")
    }

    ticketType.quantity_sold =
      Number(ticketType.quantity_sold || 0) + line.validQuantity
  }

  if (ticketRows.length > 0) {
    const { error: ticketsError } = await supabase.from("tickets").insert(ticketRows)
    if (ticketsError) {
      throw new Error(ticketsError.message || "Could not issue tickets")
    }
  }

  if (status === "completed") {
    await syncEventAttendeeAffiliationForContact(
      supabase,
      organizationId,
      contactId,
      `create order ${order.id}`
    )
  }

  revalidateTicketingPaths()
  revalidatePath(`/event-management/${input.internalEventId}`)

  return {
    orderId: order.id as string,
    orderNumber: order.order_number as string,
  }
}

export async function updateTicketOrderStatus(orderId: string, status: TicketOrderStatus) {
  await assertTicketingManagePermission()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: existingOrder, error: loadError } = await supabase
    .from("ticket_orders")
    .select("status")
    .eq("id", orderId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (loadError || !existingOrder) {
    throw new Error(loadError?.message || "Order not found")
  }

  const previousStatus = existingOrder.status as string

  const { error } = await supabase
    .from("ticket_orders")
    .update({ status })
    .eq("id", orderId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Could not update order status")
  }

  if (status === "completed" && previousStatus !== "completed") {
    await handleCompletedOrderAffiliationSync(supabase, organizationId, orderId)
  }

  revalidateTicketingPaths()
}

export async function bulkUpdateTicketOrderStatus(
  orderIds: string[],
  status: TicketOrderStatus
) {
  if (orderIds.length === 0) return

  await assertTicketingManagePermission()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const ordersBeforeUpdate =
    status === "completed"
      ? (
          await supabase
            .from("ticket_orders")
            .select("id, status")
            .eq("organization_id", organizationId)
            .in("id", orderIds)
        ).data || []
      : []

  const { error } = await supabase
    .from("ticket_orders")
    .update({ status })
    .eq("organization_id", organizationId)
    .in("id", orderIds)

  if (error) {
    throw new Error(error.message || "Could not update selected orders")
  }

  if (status === "completed") {
    const ordersToSync = ordersBeforeUpdate.filter(
      (order) => (order.status as string) !== "completed"
    )
    const syncFailures: string[] = []

    for (const order of ordersToSync) {
      try {
        await handleCompletedOrderAffiliationSync(supabase, organizationId, order.id as string, {
          throwOnFailure: true,
        })
      } catch (syncError) {
        const message = syncError instanceof Error ? syncError.message : String(syncError)
        syncFailures.push(`${order.id}: ${message}`)
        console.error(
          `[ticket-order] bulk affiliation sync failed (order ${order.id}): ${message}`
        )
      }
    }

    if (syncFailures.length > 0) {
      console.error(
        `[ticket-order] bulk affiliation sync completed with ${syncFailures.length} failure(s): ${syncFailures.join("; ")}`
      )
    }
  }

  revalidateTicketingPaths()
}

export async function refundEventTicketOrder(input: {
  orderId: string
  amountCents?: number
  ticketIds?: string[]
  note?: string | null
  notifyCustomer?: boolean
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await assertTicketingManagePermission()
    const supabase = await createClient()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }

    const withRefundedSelect = `
      id,
      status,
      total_cents,
      refunded_amount_cents,
      payment_method,
      metadata,
      stripe_checkout_session_id,
      stripe_payment_intent_id,
      internal_event_id
    `
    const withStripeSelect = `
      id,
      status,
      total_cents,
      payment_method,
      metadata,
      stripe_checkout_session_id,
      stripe_payment_intent_id,
      internal_event_id
    `
    let order: Record<string, unknown> | null = null
    let loadError: { message?: string; code?: string } | null = null

    const withRefunded = await supabase
      .from("ticket_orders")
      .select(withRefundedSelect)
      .eq("id", input.orderId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (withRefunded.error?.code === "42703") {
      const withStripe = await supabase
        .from("ticket_orders")
        .select(withStripeSelect)
        .eq("id", input.orderId)
        .eq("organization_id", organizationId)
        .maybeSingle()
      if (withStripe.error?.code === "42703") {
        const fallback = await supabase
          .from("ticket_orders")
          .select("id, status, total_cents, payment_method, metadata, internal_event_id")
          .eq("id", input.orderId)
          .eq("organization_id", organizationId)
          .maybeSingle()
        order = (fallback.data as Record<string, unknown> | null) || null
        loadError = fallback.error
      } else {
        order = (withStripe.data as Record<string, unknown> | null) || null
        loadError = withStripe.error
      }
    } else {
      order = (withRefunded.data as Record<string, unknown> | null) || null
      loadError = withRefunded.error
    }

    if (loadError || !order) {
      return { success: false, error: "Order not found." }
    }

    const orderRow = order
    const currentStatus = String(orderRow.status || "")
    if (currentStatus === "canceled" || currentStatus === "refunded") {
      return { success: true }
    }

    const metadata = asTicketOrderMetadata(orderRow.metadata)
    const checkoutSessionId =
      stringOrNull(orderRow.stripe_checkout_session_id) ||
      stringOrNull(metadata.stripeCheckoutSessionId)
    const totalCents = Number(orderRow.total_cents || 0)
    const alreadyRefunded = ticketOrderRefundedCents({
      status: currentStatus,
      totalCents,
      refundedAmountCents: Number(orderRow.refunded_amount_cents || 0),
    })

    const remainingCents = Math.max(totalCents - alreadyRefunded, 0)
    const notifyCustomer = input.notifyCustomer !== false
    const staffNote = input.note?.trim() || null

    const { data: ticketRows } = await supabase
      .from("tickets")
      .select("id, status, event_ticket_types:ticket_type_id ( price_cents )")
      .eq("organization_id", organizationId)
      .eq("ticket_order_id", String(orderRow.id))

    const activeTickets = (ticketRows || []).filter((row) => {
      const status = String(row.status || "")
      return status === "valid" || status === "checked_in" || status === "waitlisted"
    })
    const selectedIds = (input.ticketIds || []).filter((id) =>
      activeTickets.some((ticket) => ticket.id === id)
    )
    const ticketsToVoid = selectedIds.length > 0 ? selectedIds : []
    const selectedTickets =
      ticketsToVoid.length > 0
        ? activeTickets.filter((ticket) => ticketsToVoid.includes(ticket.id as string))
        : []
    const selectedPriceCents = selectedTickets.reduce((sum, ticket) => {
      const typeEmbed = Array.isArray(ticket.event_ticket_types)
        ? ticket.event_ticket_types[0]
        : ticket.event_ticket_types
      return sum + Math.max(Number((typeEmbed as { price_cents?: number } | null)?.price_cents || 0), 0)
    }, 0)

    if (currentStatus !== "completed" && currentStatus !== "partially_refunded") {
      if (checkoutSessionId) {
        await expirePendingTicketCheckoutSession(supabase, {
          organizationId,
          checkoutSessionId,
        })
      }

      const applied = await applyTicketOrderRefundInDatabase(supabase, {
        organizationId,
        orderId: String(orderRow.id),
        nextOrderStatus: "canceled",
        refundedAmountCents: alreadyRefunded,
        thisRefundCents: 0,
        ticketIdsToVoid: ticketsToVoid.length > 0 ? ticketsToVoid : undefined,
        notifyCustomer,
        staffNote,
      })

      revalidateTicketingPaths()
      if (applied.eventId) {
        revalidatePath(`/event-management/${applied.eventId}`)
      }

      return { success: true }
    }

    const suggestedCents =
      ticketsToVoid.length > 0
        ? Math.min(selectedPriceCents, remainingCents)
        : remainingCents
    const thisRefundCents =
      input.amountCents == null ? suggestedCents : Math.round(input.amountCents)
    if (thisRefundCents < 0) {
      return { success: false, error: "Enter a valid refund amount." }
    }
    if (thisRefundCents > remainingCents) {
      return {
        success: false,
        error: "Refund amount is greater than the remaining paid balance.",
      }
    }
    if (thisRefundCents <= 0 && ticketsToVoid.length === 0) {
      return { success: false, error: "Nothing left to refund on this order." }
    }

    let stripeRefundId: string | null = null
    let nextRefunded = alreadyRefunded
    if (thisRefundCents > 0) {
      const stripeResult = await createStripeTicketRefund(supabase, {
        organizationId,
        order: {
          id: String(orderRow.id),
          status: currentStatus,
          total_cents: totalCents,
          refunded_amount_cents: alreadyRefunded,
          payment_method: stringOrNull(orderRow.payment_method),
          stripe_checkout_session_id: checkoutSessionId,
          stripe_payment_intent_id: stringOrNull(orderRow.stripe_payment_intent_id),
          metadata,
        },
        amountCents: thisRefundCents,
      })
      stripeRefundId = stripeResult.refundId || null
      nextRefunded = stripeResult.alreadyRefunded
        ? totalCents
        : alreadyRefunded + thisRefundCents
    }

    const voidingAllRemaining =
      ticketsToVoid.length > 0 && ticketsToVoid.length === activeTickets.length
    const nextOrderStatus =
      nextRefunded >= totalCents && totalCents > 0
        ? "refunded"
        : nextRefunded > alreadyRefunded || (voidingAllRemaining && remainingCents === 0)
          ? nextTicketOrderRefundStatus(totalCents, Math.max(nextRefunded, alreadyRefunded))
          : nextRefunded > 0
            ? nextTicketOrderRefundStatus(totalCents, nextRefunded)
            : voidingAllRemaining
              ? "canceled"
              : "partially_refunded"

    if (nextOrderStatus === "completed") {
      return { success: false, error: "Nothing left to refund on this order." }
    }

    const applied = await applyTicketOrderRefundInDatabase(supabase, {
      organizationId,
      orderId: String(orderRow.id),
      nextOrderStatus,
      refundedAmountCents: nextRefunded,
      thisRefundCents,
      stripeRefundId,
      ticketIdsToVoid:
        nextOrderStatus === "refunded" || nextOrderStatus === "canceled"
          ? undefined
          : ticketsToVoid.length > 0
            ? ticketsToVoid
            : undefined,
      notifyCustomer,
      staffNote,
    })

    revalidateTicketingPaths()
    if (applied.eventId) {
      revalidatePath(`/event-management/${applied.eventId}`)
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not refund or cancel this order.",
    }
  }
}

export async function bulkCancelRefundOrders(orderIds: string[]) {
  if (orderIds.length === 0) return

  const errors: string[] = []
  for (const orderId of orderIds) {
    const result = await refundEventTicketOrder({ orderId })
    if (!result.success) {
      errors.push(result.error)
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join(" "))
  }
}

export async function bulkDeleteOrderPersonalData(orderIds: string[]) {
  if (orderIds.length === 0) return

  await assertTicketingManagePermission()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const deletedAt = new Date().toISOString()

  for (const orderId of orderIds) {
    const { data: order, error: loadError } = await supabase
      .from("ticket_orders")
      .select("id, metadata")
      .eq("id", orderId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (loadError || !order) {
      throw new Error("One or more orders could not be found")
    }

    const metadata = (order.metadata as Record<string, unknown>) || {}

    const { error: orderError } = await supabase
      .from("ticket_orders")
      .update({
        purchaser_name: null,
        purchaser_email: `redacted-${orderId.slice(0, 8)}@redacted.local`,
        billing_address: null,
        metadata: {
          ...metadata,
          personal_data_deleted_at: deletedAt,
        },
      })
      .eq("id", orderId)
      .eq("organization_id", organizationId)

    if (orderError) {
      throw new Error(orderError.message || "Could not delete order personal data")
    }

    const { error: ticketsError } = await supabase
      .from("tickets")
      .update({
        attendee_name: null,
        attendee_email: null,
      })
      .eq("organization_id", organizationId)
      .eq("ticket_order_id", orderId)

    if (ticketsError) {
      throw new Error(ticketsError.message || "Could not delete ticket personal data")
    }
  }

  revalidateTicketingPaths()
}

export async function getTicketTypesForEvent(internalEventId: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) return []

  const { data, error } = await supabase
    .from("event_ticket_types")
    .select("id, name, price_cents, quantity_total, quantity_sold")
    .eq("organization_id", organizationId)
    .eq("internal_event_id", internalEventId)
    .eq("is_active", true)
    .order("sort_order")

  if (error) {
    if (error.code === "42P01") return []
    throw new Error(error.message || "Could not load ticket types")
  }

  return (data || []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    priceCents: Number(row.price_cents || 0),
    quantityTotal: row.quantity_total as number | null,
    quantitySold: Number(row.quantity_sold || 0),
    quantityRemaining:
      row.quantity_total == null
        ? null
        : Math.max(Number(row.quantity_total) - Number(row.quantity_sold || 0), 0),
  }))
}

export async function getOrderTickets(orderId: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) return []

  const { data, error } = await supabase
    .from("tickets")
    .select(`
      id,
      ticket_code,
      attendee_name,
      attendee_email,
      status,
      event_ticket_types:ticket_type_id ( name, price_cents )
    `)
    .eq("organization_id", organizationId)
    .eq("ticket_order_id", orderId)
    .order("created_at")

  if (error) {
    if (error.code === "42P01") return []
    return []
  }

  return (data || []).map((row: any) => {
    const typeEmbed = Array.isArray(row.event_ticket_types)
      ? row.event_ticket_types[0]
      : row.event_ticket_types
    return {
      id: row.id as string,
      ticketCode: row.ticket_code as string,
      attendeeName: row.attendee_name as string | null,
      attendeeEmail: row.attendee_email as string | null,
      status: row.status as string,
      ticketTypeName: typeEmbed?.name || "Ticket",
      priceCents: Math.max(Number(typeEmbed?.price_cents || 0), 0),
    }
  })
}

/** Check in or undo check-in for a single event ticket seat. */
export async function setEventTicketCheckIn(input: {
  ticketId: string
  checkedIn: boolean
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const canCheckIn = await hasEventCheckInPermission()
    if (!canCheckIn) {
      return { success: false, error: "You do not have permission to check in attendees." }
    }

    const supabase = await createClient()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: ticket, error: loadError } = await supabase
      .from("tickets")
      .select("id, status, internal_event_id")
      .eq("organization_id", organizationId)
      .eq("id", input.ticketId)
      .maybeSingle()

    if (loadError || !ticket) {
      return { success: false, error: "Attendee ticket not found." }
    }

    const status = ticket.status as string
    if (status === "canceled" || status === "refunded") {
      return { success: false, error: "Cannot check in a canceled or refunded ticket." }
    }

    const patch = input.checkedIn
      ? {
          status: "checked_in",
          checked_in_at: new Date().toISOString(),
          checked_in_by: user?.id ?? null,
        }
      : {
          status: "valid",
          checked_in_at: null,
          checked_in_by: null,
        }

    const { error } = await supabase
      .from("tickets")
      .update(patch)
      .eq("organization_id", organizationId)
      .eq("id", input.ticketId)

    if (error) {
      return { success: false, error: error.message || "Could not update check-in." }
    }

    revalidatePath(`/event-management/${ticket.internal_event_id as string}`)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not update check-in.",
    }
  }
}

/** Promote a waitlisted ticket to valid when capacity is available. */
export async function promoteWaitlistedTicket(input: {
  ticketId: string
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const canManage = await hasAnyPermission(
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE,
      PERMISSIONS.TICKETING_MANAGE
    )
    if (!canManage) {
      return { success: false, error: "You do not have permission to manage waitlist." }
    }

    const supabase = await createClient()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }

    const { data: ticket, error: loadError } = await supabase
      .from("tickets")
      .select("id, status, internal_event_id, ticket_type_id")
      .eq("organization_id", organizationId)
      .eq("id", input.ticketId)
      .maybeSingle()

    if (loadError || !ticket) {
      return { success: false, error: "Ticket not found." }
    }

    if (ticket.status !== "waitlisted") {
      return { success: false, error: "This ticket is not on the waitlist." }
    }

    const { data: ticketType, error: typeError } = await supabase
      .from("event_ticket_types")
      .select("id, name, quantity_total, quantity_sold")
      .eq("organization_id", organizationId)
      .eq("id", ticket.ticket_type_id as string)
      .maybeSingle()

    if (typeError || !ticketType) {
      return { success: false, error: "Ticket type not found." }
    }

    const sold = Number(ticketType.quantity_sold || 0)
    const total = ticketType.quantity_total
    if (total != null && sold >= total) {
      return {
        success: false,
        error: `No capacity remaining for "${ticketType.name as string}".`,
      }
    }

    const { error: updateTicketError } = await supabase
      .from("tickets")
      .update({ status: "valid" })
      .eq("organization_id", organizationId)
      .eq("id", input.ticketId)

    if (updateTicketError) {
      return {
        success: false,
        error: updateTicketError.message || "Could not promote ticket.",
      }
    }

    const { error: incrementError } = await supabase
      .from("event_ticket_types")
      .update({ quantity_sold: sold + 1 })
      .eq("organization_id", organizationId)
      .eq("id", ticketType.id as string)

    if (incrementError) {
      return {
        success: false,
        error: incrementError.message || "Ticket promoted but capacity count failed.",
      }
    }

    revalidatePath(`/event-management/${ticket.internal_event_id as string}`)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not promote ticket.",
    }
  }
}

/** Staff adds a single attendee without going through the full orders UI. */
export async function addManualEventAttendee(input: {
  eventId: string
  ticketTypeId: string
  attendeeName: string
  attendeeEmail: string
  purchaserName?: string | null
  purchaserEmail?: string | null
  /** When true, register as valid even if capacity is full (waitlist off). */
  forceRegister?: boolean
}): Promise<
  | { success: true; status: "valid" | "waitlisted" }
  | { success: false; error: string }
> {
  try {
    await assertTicketingManagePermission()

    const attendeeName = input.attendeeName.trim()
    const attendeeEmail = input.attendeeEmail.trim().toLowerCase()
    if (!attendeeName) {
      return { success: false, error: "Attendee name is required." }
    }
    if (!attendeeEmail) {
      return { success: false, error: "Attendee email is required." }
    }

    const supabase = await createClient()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }

    const { data: event, error: eventError } = await supabase
      .from("internal_events")
      .select("id, ticketing_config, workspace_features, requires_ticketing")
      .eq("organization_id", organizationId)
      .eq("id", input.eventId)
      .maybeSingle()

    if (eventError || !event || event.requires_ticketing !== true) {
      return { success: false, error: "Event registration not found." }
    }

    const waitlistEnabled = resolveEventWorkspaceFeatures(event).waitlist

    const { data: ticketType, error: typeError } = await supabase
      .from("event_ticket_types")
      .select("id, name, price_cents, quantity_total, quantity_sold, is_active")
      .eq("organization_id", organizationId)
      .eq("internal_event_id", input.eventId)
      .eq("id", input.ticketTypeId)
      .maybeSingle()

    if (typeError || !ticketType || ticketType.is_active === false) {
      return { success: false, error: "Registration offering not found." }
    }

    const sold = Number(ticketType.quantity_sold || 0)
    const total = ticketType.quantity_total
    const atCapacity = total != null && sold >= total

    let ticketStatus: "valid" | "waitlisted" = "valid"
    if (atCapacity) {
      if (input.forceRegister) {
        ticketStatus = "valid"
      } else if (waitlistEnabled) {
        ticketStatus = "waitlisted"
      } else {
        return {
          success: false,
          error: `No capacity remaining for "${ticketType.name as string}".`,
        }
      }
    }

    const purchaserName = input.purchaserName?.trim() || attendeeName
    const purchaserEmail = input.purchaserEmail?.trim().toLowerCase() || attendeeEmail
    const priceCents = Number(ticketType.price_cents || 0)
    const currency =
      ((event.ticketing_config as Record<string, unknown>)?.currency as string) || "USD"

    const { contactId } = await findOrCreateContact({
      organizationId,
      fullName: purchaserName,
      email: purchaserEmail,
    })

    const { data: order, error: orderError } = await supabase
      .from("ticket_orders")
      .insert({
        organization_id: organizationId,
        internal_event_id: input.eventId,
        contact_id: contactId,
        order_number: generateOrderNumber(),
        status: "completed",
        subtotal_cents: ticketStatus === "valid" ? priceCents : 0,
        discount_cents: 0,
        total_cents: ticketStatus === "valid" ? priceCents : 0,
        currency,
        payment_method: "Manual",
        purchaser_name: purchaserName,
        purchaser_email: purchaserEmail,
      })
      .select("id")
      .single()

    if (orderError || !order) {
      return { success: false, error: orderError?.message || "Could not create order." }
    }

    const { error: ticketError } = await supabase.from("tickets").insert({
      organization_id: organizationId,
      ticket_order_id: order.id,
      ticket_type_id: input.ticketTypeId,
      internal_event_id: input.eventId,
      ticket_code: generateTicketCode(),
      attendee_name: attendeeName,
      attendee_email: attendeeEmail,
      status: ticketStatus,
    })

    if (ticketError) {
      return { success: false, error: ticketError.message || "Could not add attendee." }
    }

    if (ticketStatus === "valid") {
      const { error: incrementError } = await supabase
        .from("event_ticket_types")
        .update({ quantity_sold: sold + 1 })
        .eq("organization_id", organizationId)
        .eq("id", input.ticketTypeId)

      if (incrementError) {
        return {
          success: false,
          error: incrementError.message || "Attendee added but capacity count failed.",
        }
      }

      await syncEventAttendeeAffiliationForContact(
        supabase,
        organizationId,
        contactId,
        `manual attendee ${order.id}`
      )
    }

    revalidateTicketingPaths()
    revalidatePath(`/event-management/${input.eventId}`)
    return { success: true, status: ticketStatus }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not add attendee.",
    }
  }
}

/** Look up a ticket by code for this event and check in or undo. */
export async function checkInEventTicketByCode(input: {
  eventId: string
  ticketCode: string
  checkedIn?: boolean
}): Promise<
  | { success: true; attendeeName: string; alreadyCheckedIn: boolean }
  | { success: false; error: string }
> {
  const code = input.ticketCode.trim().toUpperCase()
  if (!code) {
    return { success: false, error: "Enter a ticket code." }
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("id, status, attendee_name, attendee_email")
    .eq("organization_id", organizationId)
    .eq("internal_event_id", input.eventId)
    .eq("ticket_code", code)
    .maybeSingle()

  if (error || !ticket) {
    return { success: false, error: "Ticket not found for this event." }
  }

  const status = ticket.status as string
  if (status === "waitlisted") {
    return { success: false, error: "This ticket is waitlisted — promote it first." }
  }
  if (status === "canceled" || status === "refunded") {
    return { success: false, error: "This ticket is canceled or refunded." }
  }

  const wantCheckedIn = input.checkedIn !== false
  if (status === "checked_in" && wantCheckedIn) {
    return {
      success: true,
      attendeeName: (ticket.attendee_name as string) || "Attendee",
      alreadyCheckedIn: true,
    }
  }

  const result = await setEventTicketCheckIn({
    ticketId: ticket.id as string,
    checkedIn: wantCheckedIn,
  })
  if (!result.success) {
    return result
  }

  return {
    success: true,
    attendeeName: (ticket.attendee_name as string) || "Attendee",
    alreadyCheckedIn: false,
  }
}

/** Look up a ticket by code across all events in the organization and check in. */
export async function checkInOrgTicketByCode(input: {
  ticketCode: string
  checkedIn?: boolean
}): Promise<
  | {
      success: true
      attendeeName: string
      alreadyCheckedIn: boolean
      eventId: string
      eventName: string
    }
  | { success: false; error: string }
> {
  const code = input.ticketCode.trim().toUpperCase()
  if (!code) {
    return { success: false, error: "Enter a ticket code." }
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const { data: tickets, error } = await supabase
    .from("tickets")
    .select("id, status, attendee_name, internal_event_id, internal_events:internal_event_id ( name )")
    .eq("organization_id", organizationId)
    .eq("ticket_code", code)
    .limit(1)

  const ticket = tickets?.[0]
  if (error || !ticket) {
    return { success: false, error: "Ticket not found." }
  }

  const eventEmbed = ticket.internal_events as { name?: string | null } | { name?: string | null }[] | null
  const eventName = Array.isArray(eventEmbed)
    ? eventEmbed[0]?.name
    : eventEmbed?.name

  const result = await checkInEventTicketByCode({
    eventId: ticket.internal_event_id as string,
    ticketCode: code,
    checkedIn: input.checkedIn,
  })
  if (!result.success) {
    return result
  }

  return {
    success: true,
    attendeeName: result.attendeeName,
    alreadyCheckedIn: result.alreadyCheckedIn,
    eventId: ticket.internal_event_id as string,
    eventName: eventName || "Event",
  }
}

/** Update attendee name/email on a ticket (transfer registration). */
export async function transferEventTicketAttendee(input: {
  ticketId: string
  attendeeName: string
  attendeeEmail: string
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const canManage = await hasAnyPermission(
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE,
      PERMISSIONS.TICKETING_MANAGE
    )
    if (!canManage) {
      return { success: false, error: "You do not have permission to update attendees." }
    }

    const name = input.attendeeName.trim()
    const email = input.attendeeEmail.trim().toLowerCase()
    if (!name) return { success: false, error: "Attendee name is required." }
    if (!email) return { success: false, error: "Attendee email is required." }

    const supabase = await createClient()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }

    const { data: ticket, error: loadError } = await supabase
      .from("tickets")
      .select("id, internal_event_id, status")
      .eq("organization_id", organizationId)
      .eq("id", input.ticketId)
      .maybeSingle()

    if (loadError || !ticket) {
      return { success: false, error: "Ticket not found." }
    }

    if (
      ticket.status === "canceled" ||
      ticket.status === "refunded"
    ) {
      return { success: false, error: "Cannot transfer a canceled or refunded ticket." }
    }

    const { error } = await supabase
      .from("tickets")
      .update({ attendee_name: name, attendee_email: email })
      .eq("organization_id", organizationId)
      .eq("id", input.ticketId)

    if (error) {
      return { success: false, error: error.message || "Could not update attendee." }
    }

    revalidatePath(`/event-management/${ticket.internal_event_id as string}`)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not update attendee.",
    }
  }
}

/** Email ticket confirmation to the attendee (or purchaser). */
export async function resendEventTicketConfirmation(input: {
  ticketId: string
}): Promise<
  | { success: true; sent: boolean; configured: boolean }
  | { success: false; error: string }
> {
  try {
    const canManage = await hasAnyPermission(
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_MANAGE,
      PERMISSIONS.TICKETING_MANAGE
    )
    if (!canManage) {
      return { success: false, error: "You do not have permission to resend confirmations." }
    }

    const supabase = await createClient()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }

    const { data: ticket, error: loadError } = await supabase
      .from("tickets")
      .select(
        `
        id,
        ticket_code,
        attendee_name,
        attendee_email,
        status,
        internal_event_id,
        event_ticket_types:ticket_type_id ( name, price_cents ),
        ticket_orders:ticket_order_id (
          order_number,
          purchaser_name,
          purchaser_email
        ),
        internal_events:internal_event_id ( name, start_at, ticketing_config )
      `
      )
      .eq("organization_id", organizationId)
      .eq("id", input.ticketId)
      .maybeSingle()

    if (loadError || !ticket) {
      return { success: false, error: "Ticket not found." }
    }

    const order = Array.isArray(ticket.ticket_orders)
      ? ticket.ticket_orders[0]
      : ticket.ticket_orders
    const ticketType = Array.isArray(ticket.event_ticket_types)
      ? ticket.event_ticket_types[0]
      : ticket.event_ticket_types
    const event = Array.isArray(ticket.internal_events)
      ? ticket.internal_events[0]
      : ticket.internal_events

    const recipientEmail =
      ((ticket.attendee_email as string | null) ||
        (order?.purchaser_email as string | null) ||
        "")
        .trim()
        .toLowerCase()

    if (!recipientEmail) {
      return { success: false, error: "No email address on this registration." }
    }

    const attendeeName =
      (ticket.attendee_name as string | null) ||
      (order?.purchaser_name as string | null) ||
      "Guest"
    const eventName = (event?.name as string) || "Event"
    const ticketTypeName = (ticketType?.name as string) || "Registration"
    const ticketCode = (ticket.ticket_code as string) || ""
    const orderNumber = (order?.order_number as string) || ""
    const startAtLabel = event?.start_at
      ? new Date(event.start_at as string).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : null

    const delivery = await sendEventOrderConfirmationEmail({
      to: recipientEmail,
      purchaserName: attendeeName,
      eventName,
      orderNumber,
      startAtLabel,
      kind: "confirmed",
      communications:
        (event as { ticketing_config?: EventTicketingConfig } | null)?.ticketing_config
          ?.communications || null,
      lines: [
        {
          ticketCode,
          ticketTypeName,
          attendeeName,
        },
      ],
    })

    return {
      success: true,
      sent: delivery.sent,
      configured: delivery.configured,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not resend confirmation.",
    }
  }
}

export type CreatePublicEventRegistrationResult =
  | {
      success: true
      orderNumber: string
      pendingPayment: boolean
      waitlisted: boolean
      checkoutUrl?: string | null
    }
  | { success: false; error: string }

/** Signed-in customer registration for a published public event. Always enforces sale windows. */
export async function createPublicEventRegistration(input: {
  orgSlug: string
  eventId: string
  purchaserName: string
  purchaserEmail: string
  lines: CreateTicketOrderLine[]
}): Promise<CreatePublicEventRegistrationResult> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "Sign in to complete registration." }
    }

    const purchaserName = input.purchaserName.trim()
    const purchaserEmail = input.purchaserEmail.trim().toLowerCase()
    if (!purchaserName) return { success: false, error: "Your name is required." }
    if (!purchaserEmail) return { success: false, error: "Your email is required." }

    const lines = input.lines.filter((line) => line.quantity > 0)
    if (lines.length === 0) {
      return { success: false, error: "Choose at least one ticket." }
    }

    const organization = await getJoinOrganizationBySlug(input.orgSlug)
    if (!organization) {
      return { success: false, error: "Organization not found." }
    }

    const admin = getServiceRoleClient()
    const { data: event, error: eventError } = await admin
      .from("internal_events")
      .select(
        "id, name, start_at, ticketing_config, workspace_features, requires_ticketing, community_calendar_status"
      )
      .eq("id", input.eventId)
      .eq("organization_id", organization.id)
      .maybeSingle()

    if (eventError || !event) {
      return { success: false, error: "Event not found." }
    }

    if (
      event.community_calendar_status !== "published" &&
      event.community_calendar_status !== "community_visible"
    ) {
      return { success: false, error: "This event is not open for public registration." }
    }

    const eventConfig = (event.ticketing_config || {}) as EventTicketingConfig
    const waitlistEnabled = resolveEventWorkspaceFeatures(event).waitlist
    const typeIds = lines.map((line) => line.ticketTypeId)

    const { data: ticketTypes, error: typesError } = await admin
      .from("event_ticket_types")
      .select(
        "id, name, price_cents, quantity_total, quantity_sold, is_active, sales_start_at, sales_end_at, visibility, min_per_order, max_per_order"
      )
      .eq("organization_id", organization.id)
      .eq("internal_event_id", input.eventId)
      .in("id", typeIds)

    if (typesError) {
      return { success: false, error: typesError.message || "Could not load ticket types." }
    }

    const typeMap = new Map((ticketTypes || []).map((row) => [row.id as string, row]))
    const pendingValidByType = new Map<string, number>()
    let subtotalCents = 0
    let waitlisted = false
    const resolvedLines: Array<{
      ticketTypeId: string
      name: string
      validQuantity: number
      waitlistQuantity: number
      priceCents: number
    }> = []

    for (const line of lines) {
      const ticketType = typeMap.get(line.ticketTypeId)
      if (!ticketType || ticketType.is_active === false) {
        return { success: false, error: "One or more ticket types are invalid." }
      }

      const visibility = (ticketType.visibility as string | null) || "public"
      if (visibility === "private") {
        return {
          success: false,
          error: `"${ticketType.name as string}" is not available for public registration.`,
        }
      }

      const saleStatus = getTicketOfferingSaleStatus({
        eventConfig,
        offeringSalesStartAt: ticketType.sales_start_at as string | null,
        offeringSalesEndAt: ticketType.sales_end_at as string | null,
      })
      if (!saleStatus.onSale) {
        return {
          success: false,
          error:
            saleStatus.reason ||
            `"${ticketType.name as string}" is not available for registration right now.`,
        }
      }

      const minPerOrder = Math.max(1, Number(ticketType.min_per_order || 1))
      const maxPerOrder =
        ticketType.max_per_order != null ? Number(ticketType.max_per_order) : null
      if (line.quantity < minPerOrder) {
        return {
          success: false,
          error: `"${ticketType.name as string}" requires at least ${minPerOrder} per order.`,
        }
      }
      if (maxPerOrder != null && line.quantity > maxPerOrder) {
        return {
          success: false,
          error: `"${ticketType.name as string}" is limited to ${maxPerOrder} per order.`,
        }
      }

      const pendingValid = pendingValidByType.get(line.ticketTypeId) || 0
      const sold = Number(ticketType.quantity_sold || 0) + pendingValid
      const total = ticketType.quantity_total
      let validQuantity = line.quantity
      let waitlistQuantity = 0

      if (total != null) {
        const available = Math.max(0, total - sold)
        validQuantity = Math.min(line.quantity, available)
        waitlistQuantity = line.quantity - validQuantity
      }

      if (waitlistQuantity > 0 && !waitlistEnabled) {
        return {
          success: false,
          error: `Not enough "${ticketType.name as string}" tickets remaining.`,
        }
      }

      pendingValidByType.set(line.ticketTypeId, pendingValid + validQuantity)
      const priceCents = Number(ticketType.price_cents || 0)
      subtotalCents += priceCents * validQuantity
      if (waitlistQuantity > 0) waitlisted = true
      resolvedLines.push({
        ticketTypeId: line.ticketTypeId,
        name: ticketType.name as string,
        validQuantity,
        waitlistQuantity,
        priceCents,
      })
    }

    const { data: linkedContact } = await admin
      .from("contacts")
      .select("id")
      .eq("organization_id", organization.id)
      .eq("auth_user_id", user.id)
      .maybeSingle()

    let contactId = (linkedContact?.id as string | undefined) || null
    if (!contactId) {
      const { data: createdContactId, error: contactError } = await admin.rpc(
        "find_or_create_contact_for_org",
        {
          p_organization_id: organization.id,
          p_full_name: purchaserName,
          p_email: purchaserEmail,
          p_phone: null,
          p_contact_type: "individual",
        }
      )
      if (contactError || !createdContactId) {
        return {
          success: false,
          error: contactError?.message || "Could not create a contact for this registration.",
        }
      }
      contactId = createdContactId as string
      await admin
        .from("contacts")
        .update({ auth_user_id: user.id })
        .eq("id", contactId)
        .eq("organization_id", organization.id)
        .is("auth_user_id", null)
    }

    if (!contactId) {
      return { success: false, error: "Could not create a contact for this registration." }
    }

    const pendingPayment = subtotalCents > 0
    const status: TicketOrderStatus = pendingPayment ? "pending" : "completed"
    const currency = eventConfig.currency || "USD"

    const { data: order, error: orderError } = await admin
      .from("ticket_orders")
      .insert({
        organization_id: organization.id,
        internal_event_id: input.eventId,
        contact_id: contactId,
        order_number: generateOrderNumber(),
        status,
        subtotal_cents: subtotalCents,
        discount_cents: 0,
        total_cents: subtotalCents,
        currency,
        payment_method: pendingPayment ? "Pay at event" : "Online",
        purchaser_name: purchaserName,
        purchaser_email: purchaserEmail,
      })
      .select("id, order_number")
      .single()

    if (orderError || !order) {
      return { success: false, error: orderError?.message || "Could not create order." }
    }

    const ticketRows: Array<Record<string, unknown>> = []
    for (const line of resolvedLines) {
      for (let index = 0; index < line.validQuantity; index += 1) {
        ticketRows.push({
          organization_id: organization.id,
          ticket_order_id: order.id,
          ticket_type_id: line.ticketTypeId,
          internal_event_id: input.eventId,
          ticket_code: generateTicketCode(),
          attendee_name: purchaserName,
          attendee_email: purchaserEmail,
          status: "valid",
        })
      }
      for (let index = 0; index < line.waitlistQuantity; index += 1) {
        ticketRows.push({
          organization_id: organization.id,
          ticket_order_id: order.id,
          ticket_type_id: line.ticketTypeId,
          internal_event_id: input.eventId,
          ticket_code: generateTicketCode(),
          attendee_name: purchaserName,
          attendee_email: purchaserEmail,
          status: "waitlisted",
        })
      }

      if (line.validQuantity <= 0) continue
      const ticketType = typeMap.get(line.ticketTypeId)!
      const { error: updateTypeError } = await admin
        .from("event_ticket_types")
        .update({
          quantity_sold: Number(ticketType.quantity_sold || 0) + line.validQuantity,
        })
        .eq("id", line.ticketTypeId)
        .eq("organization_id", organization.id)

      if (updateTypeError) {
        return {
          success: false,
          error: updateTypeError.message || "Could not update ticket inventory.",
        }
      }
      ticketType.quantity_sold =
        Number(ticketType.quantity_sold || 0) + line.validQuantity
    }

    if (ticketRows.length > 0) {
      const { error: ticketsError } = await admin.from("tickets").insert(ticketRows)
      if (ticketsError) {
        return { success: false, error: ticketsError.message || "Could not issue tickets." }
      }
    }

    if (status === "completed") {
      await syncEventAttendeeAffiliationForContact(
        admin,
        organization.id,
        contactId,
        `public order ${order.id}`
      )
    }

    const startAtLabel = event.start_at
      ? new Date(event.start_at as string).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : null

    const { data: issuedTickets } = await admin
      .from("tickets")
      .select("ticket_code, attendee_name, event_ticket_types:ticket_type_id ( name )")
      .eq("ticket_order_id", order.id)
      .eq("organization_id", organization.id)

    const confirmationLines = (issuedTickets || []).map((row) => {
      const typeEmbed = Array.isArray(row.event_ticket_types)
        ? row.event_ticket_types[0]
        : row.event_ticket_types
      return {
        ticketCode: (row.ticket_code as string) || "",
        ticketTypeName: (typeEmbed?.name as string) || "Registration",
        attendeeName: (row.attendee_name as string) || purchaserName,
      }
    })

    let checkoutUrl: string | null = null
    if (pendingPayment) {
      const stripeResult = await startTicketStripeCheckout({
        supabase: admin,
        organizationId: organization.id,
        orgSlug: organization.slug,
        eventId: input.eventId,
        eventName: (event.name as string) || "Event",
        orderId: order.id as string,
        orderNumber: order.order_number as string,
        purchaserEmail,
        currency,
        lines: resolvedLines.map((line) => ({
          name: line.name,
          quantity: line.validQuantity,
          priceCents: line.priceCents,
        })),
      })
      if ("checkoutUrl" in stripeResult) {
        checkoutUrl = stripeResult.checkoutUrl
      }
    }

    if (!checkoutUrl) {
      await sendEventOrderConfirmationEmail({
        to: purchaserEmail,
        purchaserName,
        eventName: (event.name as string) || "Event",
        orderNumber: order.order_number as string,
        startAtLabel,
        kind: pendingPayment ? "reserved" : "confirmed",
        communications: eventConfig.communications || null,
        lines: confirmationLines,
      })
    }

    revalidateTicketingPaths()
    revalidatePath(`/event-management/${input.eventId}`)
    revalidatePath(`/o/${organization.slug}/events/${input.eventId}`)
    revalidatePath(`/o/${organization.slug}/community-calendar`)

    return {
      success: true,
      orderNumber: order.order_number as string,
      pendingPayment,
      waitlisted,
      checkoutUrl,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not complete registration.",
    }
  }
}

/** Staff records payment for a pending public/pay-at-event ticket order. */
export async function completePendingEventTicketOrder(input: {
  orderId: string
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await assertTicketingManagePermission()
    const supabase = await createClient()
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }

    const { data: order, error } = await supabase
      .from("ticket_orders")
      .select(
        `
        id,
        status,
        internal_event_id,
        contact_id,
        order_number,
        purchaser_name,
        purchaser_email,
        internal_events:internal_event_id ( name, start_at, ticketing_config )
      `
      )
      .eq("id", input.orderId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (error || !order) {
      return { success: false, error: "Order not found." }
    }
    if (order.status === "completed") {
      return { success: true }
    }
    if (order.status !== "pending") {
      return { success: false, error: "Only pending orders can be marked paid." }
    }

    const { error: updateError } = await supabase
      .from("ticket_orders")
      .update({
        status: "completed",
        payment_method: "Staff",
      })
      .eq("id", order.id)
      .eq("organization_id", organizationId)

    if (updateError) {
      return { success: false, error: updateError.message || "Could not mark order paid." }
    }

    if (order.contact_id) {
      await syncEventAttendeeAffiliationForContact(
        supabase,
        organizationId,
        order.contact_id as string,
        `staff complete order ${order.id}`
      )
    }

    const purchaserEmail = ((order.purchaser_email as string) || "").trim()
    if (purchaserEmail) {
      const eventEmbed = Array.isArray(order.internal_events)
        ? order.internal_events[0]
        : order.internal_events
      const { data: tickets } = await supabase
        .from("tickets")
        .select("ticket_code, attendee_name, event_ticket_types:ticket_type_id ( name )")
        .eq("ticket_order_id", order.id)
        .eq("organization_id", organizationId)

      await sendEventOrderConfirmationEmail({
        to: purchaserEmail,
        purchaserName: (order.purchaser_name as string) || "Guest",
        eventName: (eventEmbed?.name as string) || "Event",
        orderNumber: (order.order_number as string) || "",
        startAtLabel: eventEmbed?.start_at
          ? new Date(eventEmbed.start_at as string).toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
          : null,
        kind: "confirmed",
        communications:
          (
            eventEmbed as { ticketing_config?: EventTicketingConfig } | null
          )?.ticketing_config?.communications || null,
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

    revalidateTicketingPaths()
    revalidatePath(`/event-management/${order.internal_event_id as string}`)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not mark order paid.",
    }
  }
}

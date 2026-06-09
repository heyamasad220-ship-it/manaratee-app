"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { revalidateTicketingPaths } from "@/lib/tickets/revalidate-ticketing-paths"
import type { TicketingSalesStatus } from "./ticket-types"
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
    PERMISSIONS.PROGRAMS_MANAGE
  )
  if (!canManage) {
    throw new Error("You do not have permission to manage ticket orders.")
  }
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
    .select("id, name, ticketing_config")
    .eq("id", input.internalEventId)
    .eq("organization_id", organizationId)
    .eq("requires_ticketing", true)
    .maybeSingle()

  if (eventError || !event) {
    throw new Error("Ticketed event not found")
  }

  const typeIds = lines.map((line) => line.ticketTypeId)
  const { data: ticketTypes, error: typesError } = await supabase
    .from("event_ticket_types")
    .select("id, name, price_cents, quantity_total, quantity_sold, is_active")
    .eq("organization_id", organizationId)
    .eq("internal_event_id", input.internalEventId)
    .in("id", typeIds)

  if (typesError) {
    throw new Error(typesError.message || "Could not load ticket types")
  }

  const typeMap = new Map((ticketTypes || []).map((row) => [row.id as string, row]))
  let subtotalCents = 0
  const resolvedLines: Array<{
    ticketTypeId: string
    quantity: number
    priceCents: number
    name: string
  }> = []

  for (const line of lines) {
    const ticketType = typeMap.get(line.ticketTypeId)
    if (!ticketType || ticketType.is_active === false) {
      throw new Error("One or more ticket types are invalid.")
    }

    const sold = Number(ticketType.quantity_sold || 0)
    const total = ticketType.quantity_total
    if (total != null && sold + line.quantity > total) {
      throw new Error(`Not enough "${ticketType.name}" tickets remaining.`)
    }

    const priceCents = Number(ticketType.price_cents || 0)
    subtotalCents += priceCents * line.quantity
    resolvedLines.push({
      ticketTypeId: line.ticketTypeId,
      quantity: line.quantity,
      priceCents,
      name: ticketType.name as string,
    })
  }

  const currency =
    ((event.ticketing_config as Record<string, unknown>)?.currency as string) || "USD"
  const status = input.status || "completed"

  const { data: order, error: orderError } = await supabase
    .from("ticket_orders")
    .insert({
      organization_id: organizationId,
      internal_event_id: input.internalEventId,
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
    for (let index = 0; index < line.quantity; index += 1) {
      ticketRows.push({
        organization_id: organizationId,
        ticket_order_id: order.id,
        ticket_type_id: line.ticketTypeId,
        internal_event_id: input.internalEventId,
        ticket_code: generateTicketCode(),
        attendee_name: cleanName,
        attendee_email: cleanEmail,
        status: status === "completed" ? "valid" : "valid",
      })
    }

    const ticketType = typeMap.get(line.ticketTypeId)!
    const { error: updateTypeError } = await supabase
      .from("event_ticket_types")
      .update({
        quantity_sold: Number(ticketType.quantity_sold || 0) + line.quantity,
      })
      .eq("id", line.ticketTypeId)
      .eq("organization_id", organizationId)

    if (updateTypeError) {
      throw new Error(updateTypeError.message || "Could not update ticket inventory")
    }
  }

  if (ticketRows.length > 0) {
    const { error: ticketsError } = await supabase.from("tickets").insert(ticketRows)
    if (ticketsError) {
      throw new Error(ticketsError.message || "Could not issue tickets")
    }
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

  const { error } = await supabase
    .from("ticket_orders")
    .update({ status })
    .eq("id", orderId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Could not update order status")
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

  const { error } = await supabase
    .from("ticket_orders")
    .update({ status })
    .eq("organization_id", organizationId)
    .in("id", orderIds)

  if (error) {
    throw new Error(error.message || "Could not update selected orders")
  }

  revalidateTicketingPaths()
}

export async function bulkCancelRefundOrders(orderIds: string[]) {
  if (orderIds.length === 0) return

  await assertTicketingManagePermission()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: orders, error: loadError } = await supabase
    .from("ticket_orders")
    .select("id, status")
    .eq("organization_id", organizationId)
    .in("id", orderIds)

  if (loadError) {
    throw new Error(loadError.message || "Could not load selected orders")
  }

  for (const order of orders || []) {
    const orderId = order.id as string
    const currentStatus = order.status as string

    if (currentStatus === "canceled" || currentStatus === "refunded") {
      continue
    }

    const nextStatus =
      currentStatus === "completed" || currentStatus === "partially_refunded"
        ? "refunded"
        : "canceled"

    const { error: orderError } = await supabase
      .from("ticket_orders")
      .update({ status: nextStatus })
      .eq("id", orderId)
      .eq("organization_id", organizationId)

    if (orderError) {
      throw new Error(orderError.message || "Could not update order")
    }

    const ticketStatus = nextStatus === "refunded" ? "refunded" : "canceled"

    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select("id, ticket_type_id, status")
      .eq("organization_id", organizationId)
      .eq("ticket_order_id", orderId)
      .in("status", ["valid", "checked_in"])

    if (ticketsError) {
      throw new Error(ticketsError.message || "Could not load tickets")
    }

    if (tickets?.length) {
      const { error: ticketUpdateError } = await supabase
        .from("tickets")
        .update({ status: ticketStatus })
        .eq("organization_id", organizationId)
        .eq("ticket_order_id", orderId)
        .in("status", ["valid", "checked_in"])

      if (ticketUpdateError) {
        throw new Error(ticketUpdateError.message || "Could not update tickets")
      }

      if (nextStatus === "refunded" || nextStatus === "canceled") {
        const countsByType = new Map<string, number>()
        for (const ticket of tickets) {
          const typeId = ticket.ticket_type_id as string
          countsByType.set(typeId, (countsByType.get(typeId) || 0) + 1)
        }

        for (const [typeId, count] of countsByType) {
          const { data: ticketType, error: typeError } = await supabase
            .from("event_ticket_types")
            .select("quantity_sold")
            .eq("id", typeId)
            .eq("organization_id", organizationId)
            .maybeSingle()

          if (typeError || !ticketType) continue

          const nextSold = Math.max(Number(ticketType.quantity_sold || 0) - count, 0)
          await supabase
            .from("event_ticket_types")
            .update({ quantity_sold: nextSold })
            .eq("id", typeId)
            .eq("organization_id", organizationId)
        }
      }
    }
  }

  revalidateTicketingPaths()
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
      event_ticket_types:ticket_type_id ( name )
    `)
    .eq("organization_id", organizationId)
    .eq("ticket_order_id", orderId)
    .order("created_at")

  if (error) {
    if (error.code === "42P01") return []
    return []
  }

  return (data || []).map((row: any) => ({
    id: row.id as string,
    ticketCode: row.ticket_code as string,
    attendeeName: row.attendee_name as string | null,
    attendeeEmail: row.attendee_email as string | null,
    status: row.status as string,
    ticketTypeName: row.event_ticket_types?.name || "Ticket",
  }))
}

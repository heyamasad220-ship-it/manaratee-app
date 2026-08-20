"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import {
  startTicketStripeCheckout,
  type TicketStripeLine,
} from "@/lib/tickets/ticket-stripe"

function uniqueEmails(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (value || "").trim().toLowerCase())
        .filter(Boolean)
    )
  )
}

async function loadOwnedCustomerOrder(input: { orderId: string }) {
  const { supabase, session } = await getCustomerPortalSupabase()
  const { activeOrganization } = await getActiveOrganization()
  if (!activeOrganization) {
    return { error: "No organization selected." as const }
  }

  const organizationId = activeOrganization.organization_id
  const admin = getServiceRoleClient()

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, email")
    .eq("organization_id", organizationId)
    .eq("auth_user_id", session.effectiveUserId)
    .maybeSingle()

  const emails = uniqueEmails([
    contact?.email as string | null,
    session.authenticatedUser.email,
  ])

  const { data: order, error } = await admin
    .from("ticket_orders")
    .select(
      `
      id,
      status,
      order_number,
      purchaser_email,
      contact_id,
      currency,
      total_cents,
      internal_event_id,
      internal_events:internal_event_id ( name )
    `
    )
    .eq("id", input.orderId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error || !order) {
    return { error: "Order not found." as const }
  }

  const purchaserEmail = ((order.purchaser_email as string) || "").trim().toLowerCase()
  const ownsOrder =
    (contact?.id && order.contact_id === contact.id) ||
    (purchaserEmail && emails.includes(purchaserEmail))
  if (!ownsOrder) {
    return { error: "Order not found." as const }
  }

  return {
    admin,
    session,
    organizationId,
    order,
    purchaserEmail,
  }
}

async function restoreSoldInventory(
  admin: SupabaseClient,
  organizationId: string,
  orderId: string
) {
  const { data: tickets } = await admin
    .from("tickets")
    .select("ticket_type_id, status")
    .eq("organization_id", organizationId)
    .eq("ticket_order_id", orderId)
    .in("status", ["valid", "checked_in"])

  const countsByType = new Map<string, number>()
  for (const ticket of tickets || []) {
    const typeId = ticket.ticket_type_id as string
    countsByType.set(typeId, (countsByType.get(typeId) || 0) + 1)
  }

  for (const [typeId, count] of countsByType) {
    const { data: ticketType } = await admin
      .from("event_ticket_types")
      .select("quantity_sold")
      .eq("id", typeId)
      .eq("organization_id", organizationId)
      .maybeSingle()
    if (!ticketType) continue
    const nextSold = Math.max(Number(ticketType.quantity_sold || 0) - count, 0)
    await admin
      .from("event_ticket_types")
      .update({ quantity_sold: nextSold })
      .eq("id", typeId)
      .eq("organization_id", organizationId)
  }
}

export async function resumeCustomerTicketCheckout(input: {
  orderId: string
}): Promise<{ success: true; checkoutUrl: string } | { success: false; error: string }> {
  try {
    const loaded = await loadOwnedCustomerOrder(input)
    if ("error" in loaded) {
      return { success: false, error: loaded.error }
    }
    const { admin, session, organizationId, order, purchaserEmail } = loaded

    if (order.status !== "pending") {
      return { success: false, error: "This order is already paid or closed." }
    }
    if (Number(order.total_cents || 0) <= 0) {
      return { success: false, error: "This order does not require payment." }
    }

    const { data: org } = await admin
      .from("organizations")
      .select("slug")
      .eq("id", organizationId)
      .maybeSingle()
    const orgSlug = ((org?.slug as string) || "").trim().toLowerCase()
    if (!orgSlug) {
      return { success: false, error: "Could not start checkout." }
    }

    const { data: tickets } = await admin
      .from("tickets")
      .select(
        "status, event_ticket_types:ticket_type_id ( name, price_cents )"
      )
      .eq("ticket_order_id", order.id)
      .eq("organization_id", organizationId)

    const linesByType = new Map<string, TicketStripeLine>()
    for (const ticket of tickets || []) {
      if ((ticket.status as string) === "waitlisted") continue
      const typeEmbed = Array.isArray(ticket.event_ticket_types)
        ? ticket.event_ticket_types[0]
        : ticket.event_ticket_types
      const name = (typeEmbed?.name as string) || "Registration"
      const priceCents = Number(typeEmbed?.price_cents || 0)
      if (priceCents <= 0) continue
      const current = linesByType.get(name)
      if (current) {
        current.quantity += 1
      } else {
        linesByType.set(name, { name, quantity: 1, priceCents })
      }
    }

    const eventEmbed = Array.isArray(order.internal_events)
      ? order.internal_events[0]
      : order.internal_events

    const stripeResult = await startTicketStripeCheckout({
      supabase: admin,
      organizationId,
      orgSlug,
      eventId: order.internal_event_id as string,
      eventName: (eventEmbed?.name as string) || "Event",
      orderId: order.id as string,
      orderNumber: order.order_number as string,
      purchaserEmail:
        purchaserEmail || session.authenticatedUser.email || "",
      currency: (order.currency as string) || "USD",
      lines: Array.from(linesByType.values()),
    })

    if (!("checkoutUrl" in stripeResult)) {
      return {
        success: false,
        error:
          "Online checkout is not available. Pay at the event or ask staff to mark this order paid.",
      }
    }

    return { success: true, checkoutUrl: stripeResult.checkoutUrl }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not start checkout.",
    }
  }
}

export async function cancelCustomerPendingTicketOrder(input: {
  orderId: string
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const loaded = await loadOwnedCustomerOrder(input)
    if ("error" in loaded) {
      return { success: false, error: loaded.error }
    }
    const { admin, organizationId, order } = loaded

    if (order.status !== "pending") {
      return {
        success: false,
        error: "Only unpaid reservations can be cancelled here.",
      }
    }

    await restoreSoldInventory(admin, organizationId, order.id as string)

    const { error: ticketError } = await admin
      .from("tickets")
      .update({ status: "canceled" })
      .eq("ticket_order_id", order.id)
      .eq("organization_id", organizationId)
      .in("status", ["valid", "waitlisted", "checked_in"])

    if (ticketError) {
      return { success: false, error: ticketError.message || "Could not cancel tickets." }
    }

    const { error: orderError } = await admin
      .from("ticket_orders")
      .update({ status: "canceled" })
      .eq("id", order.id)
      .eq("organization_id", organizationId)

    if (orderError) {
      return { success: false, error: orderError.message || "Could not cancel the order." }
    }

    revalidatePath("/customer/tickets")
    revalidatePath(`/event-management/${order.internal_event_id as string}`)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not cancel the reservation.",
    }
  }
}

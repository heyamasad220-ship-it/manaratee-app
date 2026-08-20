import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import { buildPublicCommunityEventPath } from "@/lib/community-calendar/public-paths"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import {
  mapCustomerTicketOrderStatus,
  mapCustomerTicketStatus,
  type CustomerTicketOrder,
} from "@/lib/tickets/customer-ticket-types"

function uniqueEmails(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (value || "").trim().toLowerCase())
        .filter(Boolean)
    )
  )
}

export async function getCustomerTicketOrders(): Promise<CustomerTicketOrder[]> {
  const { supabase, session } = await getCustomerPortalSupabase()
  const { activeOrganization } = await getActiveOrganization()
  if (!activeOrganization) return []

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

  const filters: string[] = []
  if (contact?.id) filters.push(`contact_id.eq.${contact.id}`)
  for (const email of emails) {
    filters.push(`purchaser_email.eq."${email.replaceAll('"', "")}"`)
  }
  if (filters.length === 0) return []

  const { data: orders, error } = await admin
    .from("ticket_orders")
    .select(
      `
      id,
      order_number,
      status,
      total_cents,
      refunded_amount_cents,
      currency,
      payment_method,
      created_at,
      contact_id,
      purchaser_email,
      internal_event_id,
      internal_events:internal_event_id (
        name,
        start_at,
        location_label,
        location_address,
        community_calendar_status
      )
    `
    )
    .eq("organization_id", organizationId)
    .or(filters.join(","))
    .order("created_at", { ascending: false })
  if (error?.code === "42703") {
    const fallback = await admin
      .from("ticket_orders")
      .select(
        `
        id,
        order_number,
        status,
        total_cents,
        currency,
        payment_method,
        created_at,
        contact_id,
        purchaser_email,
        internal_event_id,
        internal_events:internal_event_id (
          name,
          start_at,
          location_label,
          location_address,
          community_calendar_status
        )
      `
      )
      .eq("organization_id", organizationId)
      .or(filters.join(","))
      .order("created_at", { ascending: false })
    if (fallback.error) {
      if (fallback.error.code === "42P01" || fallback.error.code === "42703") return []
      console.error("getCustomerTicketOrders:", fallback.error.message)
      return []
    }
    return mapCustomerTicketOrders(
      (fallback.data || []) as Record<string, unknown>[],
      organizationId,
      admin
    )
  }
  if (error) {
    if (error.code === "42P01") return []
    console.error("getCustomerTicketOrders:", error.message)
    return []
  }

  return mapCustomerTicketOrders(
    (orders || []) as Record<string, unknown>[],
    organizationId,
    admin
  )
}

async function mapCustomerTicketOrders(
  rows: Record<string, unknown>[],
  organizationId: string,
  admin: ReturnType<typeof getServiceRoleClient>
): Promise<CustomerTicketOrder[]> {
  if (rows.length === 0) return []

  const { data: org } = await admin
    .from("organizations")
    .select("slug")
    .eq("id", organizationId)
    .maybeSingle()
  const orgSlug = ((org?.slug as string) || "").trim().toLowerCase()

  const orderIds = rows.map((row) => row.id as string)
  const { data: tickets } = await admin
    .from("tickets")
    .select(
      `
      id,
      ticket_order_id,
      ticket_code,
      attendee_name,
      status,
      checked_in_at,
      event_ticket_types:ticket_type_id ( name )
    `
    )
    .eq("organization_id", organizationId)
    .in("ticket_order_id", orderIds)
    .order("created_at", { ascending: true })

  const ticketsByOrder = new Map<string, CustomerTicketOrder["tickets"]>()
  for (const ticket of tickets || []) {
    const orderId = ticket.ticket_order_id as string
    const typeEmbed = Array.isArray(ticket.event_ticket_types)
      ? ticket.event_ticket_types[0]
      : ticket.event_ticket_types
    const list = ticketsByOrder.get(orderId) || []
    list.push({
      id: ticket.id as string,
      ticketCode: (ticket.ticket_code as string) || "",
      attendeeName: (ticket.attendee_name as string | null) ?? null,
      ticketTypeName: (typeEmbed?.name as string) || "Registration",
      status: mapCustomerTicketStatus((ticket.status as string) || "valid"),
      checkedInAt: (ticket.checked_in_at as string | null) ?? null,
    })
    ticketsByOrder.set(orderId, list)
  }

  return rows.map((row) => {
    const eventEmbed = Array.isArray(row.internal_events)
      ? row.internal_events[0]
      : row.internal_events
    const calendarStatus = (eventEmbed?.community_calendar_status as string) || ""
    const isPublic =
      calendarStatus === "published" || calendarStatus === "community_visible"
    const orderStatus = mapCustomerTicketOrderStatus((row.status as string) || "pending")
    const location =
      [eventEmbed?.location_label, eventEmbed?.location_address]
        .map((value) => (value as string | null)?.trim())
        .filter(Boolean)
        .join(" — ") || null

    return {
      id: row.id as string,
      orderNumber: (row.order_number as string) || "",
      status: orderStatus,
      totalCents: Number(row.total_cents || 0),
      refundedCents: Number(row.refunded_amount_cents || 0),
      currency: (row.currency as string) || "USD",
      paymentMethod: (row.payment_method as string | null) ?? null,
      createdAt: row.created_at as string,
      eventId: row.internal_event_id as string,
      eventName: (eventEmbed?.name as string) || "Event",
      eventStartAt: (eventEmbed?.start_at as string | null) ?? null,
      eventLocation: location,
      publicEventPath:
        orgSlug && isPublic
          ? buildPublicCommunityEventPath(orgSlug, row.internal_event_id as string)
          : null,
      canResumeCheckout: orderStatus === "pending" && Number(row.total_cents || 0) > 0,
      tickets: ticketsByOrder.get(row.id as string) || [],
    }
  })
}

"use server"

import { revalidatePath } from "next/cache"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import { canLinkEventToCampaign, EVENT_WORKSPACE_VIEW_PERMISSIONS } from "@/lib/events/event-access"
import { linkedCampaignIdFromConfig } from "@/lib/events/event-finance-types"
import { getInternalEventRecordById } from "@/lib/events/internal-event-queries"
import { getInternalEventStatusLabel } from "@/lib/events/internal-event-status"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { EventTicketingConfig } from "@/lib/tickets/ticket-types"
import { ticketOrderNetRevenueCents } from "@/lib/tickets/ticket-refund-math"
import {
  isOrganizationModuleEnabled,
  loadOrganizationEnabledModuleSlugs,
} from "@/lib/modules/dashboard-module-access-server"

const EVENT_LIST_SELECT =
  "id, name, start_at, end_at, status, requires_ticketing, location_label, ticketing_config, departments:department_id ( name )"

export type CampaignEventListItem = {
  id: string
  name: string
  startAt: string | null
  endAt: string | null
  status: string
  statusLabel: string
  requiresTicketing: boolean
  locationLabel: string | null
  departmentName: string | null
}

export type CampaignAttachableEventOption = CampaignEventListItem & {
  linkedCampaignId: string | null
}

export type CampaignEventTicketTypeStat = {
  id: string
  name: string
  sold: number
  capacity: number | null
  remaining: number | null
  priceCents: number
}

export type CampaignEventStats = {
  eventId: string
  requiresTicketing: boolean
  ticketsSold: number
  ticketsCapacity: number | null
  ticketsRemaining: number | null
  checkedIn: number
  waitlisted: number
  revenueCents: number
  currency: string
  types: CampaignEventTicketTypeStat[]
}

export type CampaignEventsTabResult = {
  success: true
  linked: CampaignEventListItem[]
  stats: CampaignEventStats | null
  attachable: CampaignAttachableEventOption[]
  canAttach: boolean
  canCreate: boolean
  canOpenEvent: boolean
  eventManagementEnabled: boolean
}

function mapEventRow(row: Record<string, unknown>): CampaignEventListItem {
  const departmentRaw = row.departments as
    | { name?: string | null }
    | { name?: string | null }[]
    | null
  const department = Array.isArray(departmentRaw) ? departmentRaw[0] : departmentRaw
  const status = String(row.status || "draft")
  return {
    id: row.id as string,
    name: (row.name as string) || "Untitled event",
    startAt: (row.start_at as string | null) ?? null,
    endAt: (row.end_at as string | null) ?? null,
    status,
    statusLabel: getInternalEventStatusLabel(status),
    requiresTicketing: row.requires_ticketing === true,
    locationLabel: (row.location_label as string | null) ?? null,
    departmentName: department?.name || null,
  }
}

async function fetchOrgEvents(
  organizationId: string,
  options?: { linkedCampaignId?: string; limit?: number }
) {
  const writeClient = createServiceRoleClient()
  const limit = Math.min(Math.max(options?.limit ?? 200, 1), 200)
  let query = writeClient
    .from("internal_events")
    .select(EVENT_LIST_SELECT)
    .eq("organization_id", organizationId)
    .order("start_at", { ascending: false, nullsFirst: false })
    .limit(limit)

  if (options?.linkedCampaignId) {
    query = query.filter(
      "ticketing_config->>linkedCampaignId",
      "eq",
      options.linkedCampaignId
    )
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }
  return (data || []) as Record<string, unknown>[]
}

async function loadCampaignEventStats(
  organizationId: string,
  event: CampaignEventListItem
): Promise<CampaignEventStats> {
  const writeClient = createServiceRoleClient()
  const empty: CampaignEventStats = {
    eventId: event.id,
    requiresTicketing: event.requiresTicketing,
    ticketsSold: 0,
    ticketsCapacity: null,
    ticketsRemaining: null,
    checkedIn: 0,
    waitlisted: 0,
    revenueCents: 0,
    currency: "USD",
    types: [],
  }

  const [typesResult, ordersResult, checkedInResult, waitlistedResult] =
    await Promise.all([
      writeClient
        .from("event_ticket_types")
        .select("id, name, price_cents, quantity_total, quantity_sold, is_active, sort_order")
        .eq("organization_id", organizationId)
        .eq("internal_event_id", event.id)
        .order("sort_order"),
      writeClient
        .from("ticket_orders")
        .select("total_cents, refunded_amount_cents, currency, status")
        .eq("organization_id", organizationId)
        .eq("internal_event_id", event.id)
        .in("status", ["completed", "partially_refunded"]),
      writeClient
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("internal_event_id", event.id)
        .eq("status", "checked_in"),
      writeClient
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("internal_event_id", event.id)
        .eq("status", "waitlisted"),
    ])

  let orderRows = ordersResult.data || []
  if (ordersResult.error?.code === "42703") {
    const fallback = await writeClient
      .from("ticket_orders")
      .select("total_cents, currency, status")
      .eq("organization_id", organizationId)
      .eq("internal_event_id", event.id)
      .in("status", ["completed", "partially_refunded"])
    orderRows = fallback.data || []
  }

  const types = (typesResult.data || [])
    .filter((row) => row.is_active !== false || Number(row.quantity_sold || 0) > 0)
    .map((row) => {
      const sold = Number(row.quantity_sold || 0)
      const capacity =
        row.quantity_total == null ? null : Number(row.quantity_total)
      return {
        id: row.id as string,
        name: (row.name as string) || "Ticket",
        sold,
        capacity,
        remaining: capacity == null ? null : Math.max(capacity - sold, 0),
        priceCents: Number(row.price_cents || 0),
      }
    })

  let ticketsSold = 0
  let ticketsCapacity: number | null = types.length > 0 ? 0 : null
  for (const type of types) {
    ticketsSold += type.sold
    if (type.capacity == null) {
      ticketsCapacity = null
    } else if (ticketsCapacity != null) {
      ticketsCapacity += type.capacity
    }
  }

  let revenueCents = 0
  let currency = "USD"
  for (const row of orderRows) {
    currency = (row.currency as string) || currency
    revenueCents += ticketOrderNetRevenueCents({
      status: row.status as string,
      totalCents: Number(row.total_cents || 0),
      refundedAmountCents: Number(
        (row as { refunded_amount_cents?: number }).refunded_amount_cents || 0
      ),
    })
  }

  return {
    ...empty,
    ticketsSold,
    ticketsCapacity,
    ticketsRemaining:
      ticketsCapacity == null ? null : Math.max(ticketsCapacity - ticketsSold, 0),
    checkedIn: checkedInResult.count || 0,
    waitlisted: waitlistedResult.count || 0,
    revenueCents,
    currency,
    types,
  }
}

export async function listCampaignEventsAction(
  campaignId: string
): Promise<CampaignEventsTabResult | { success: false; error: string }> {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false, error: access.error }

  const id = campaignId.trim()
  if (!id) return { success: false, error: "Campaign is required" }

  try {
    let rows: Record<string, unknown>[]
    try {
      rows = await fetchOrgEvents(access.orgId, { linkedCampaignId: id })
    } catch {
      const allRows = await fetchOrgEvents(access.orgId, { limit: 200 })
      rows = allRows.filter(
        (row) =>
          linkedCampaignIdFromConfig(
            row.ticketing_config as EventTicketingConfig | null
          ) === id
      )
    }

    const enabledSlugs = await loadOrganizationEnabledModuleSlugs(access.orgId)
    const eventManagementEnabled = isOrganizationModuleEnabled(
      enabledSlugs,
      "event-management"
    )

    if (!eventManagementEnabled) {
      return {
        success: true,
        linked: [],
        stats: null,
        attachable: [],
        canAttach: false,
        canCreate: false,
        canOpenEvent: false,
        eventManagementEnabled: false,
      }
    }

    const [canCreate, canOpenEvent] = await Promise.all([
      hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
      hasAnyPermission(...EVENT_WORKSPACE_VIEW_PERMISSIONS, PERMISSIONS.EVENTS_MANAGE),
    ])

    const linked = rows.map(mapEventRow)
    const stats =
      linked[0] != null
        ? await loadCampaignEventStats(access.orgId, linked[0])
        : null

    return {
      success: true,
      linked,
      stats,
      attachable: [],
      canAttach: access.canManageCampaigns,
      canCreate,
      canOpenEvent,
      eventManagementEnabled: true,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not load campaign events.",
    }
  }
}

export async function listAttachableCampaignEventsAction(
  campaignId: string
): Promise<
  | { success: true; events: CampaignAttachableEventOption[] }
  | { success: false; error: string }
> {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false, error: access.error }

  const id = campaignId.trim()
  if (!id) return { success: false, error: "Campaign is required" }

  try {
    const enabledSlugs = await loadOrganizationEnabledModuleSlugs(access.orgId)
    if (!isOrganizationModuleEnabled(enabledSlugs, "event-management")) {
      return { success: true, events: [] }
    }

    const rows = await fetchOrgEvents(access.orgId, { limit: 200 })
    const events = rows
      .map((row) => {
        const linkedCampaignId = linkedCampaignIdFromConfig(
          row.ticketing_config as EventTicketingConfig | null
        )
        return { ...mapEventRow(row), linkedCampaignId }
      })
      .filter((event) => event.linkedCampaignId !== id)

    return { success: true, events }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not load events.",
    }
  }
}

async function writeLinkedCampaign(input: {
  eventId: string
  linkedCampaignId: string | null
}): Promise<{ success: true } | { success: false; error: string }> {
  const canLink = await canLinkEventToCampaign(input.eventId)
  if (!canLink) {
    return {
      success: false,
      error: "You do not have permission to link this event to a campaign.",
    }
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected" }
  }

  const existingEvent = await getInternalEventRecordById(input.eventId)
  if (!existingEvent) {
    return { success: false, error: "Event not found." }
  }

  const previousCampaignId = linkedCampaignIdFromConfig(
    existingEvent.ticketing_config as EventTicketingConfig | null
  )

  if (input.linkedCampaignId) {
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", input.linkedCampaignId)
      .maybeSingle()

    if (campaignError || !campaign) {
      return { success: false, error: "Campaign not found." }
    }
  }

  const ticketingConfig =
    (existingEvent.ticketing_config as Record<string, unknown>) || {}

  const { error } = await supabase
    .from("internal_events")
    .update({
      ticketing_config: {
        ...ticketingConfig,
        linkedCampaignId: input.linkedCampaignId,
      },
    })
    .eq("id", input.eventId)
    .eq("organization_id", organizationId)

  if (error) {
    return { success: false, error: error.message || "Failed to link campaign." }
  }

  revalidatePath(`/event-management/${input.eventId}`)
  if (previousCampaignId) {
    revalidatePath(`/donations/campaigns/${previousCampaignId}`)
  }
  if (input.linkedCampaignId) {
    revalidatePath(`/donations/campaigns/${input.linkedCampaignId}`)
  }
  return { success: true }
}

export async function attachEventToCampaignAction(input: {
  campaignId: string
  eventId: string
}): Promise<{ success: true } | { success: false; error: string }> {
  const access = await requireDonationStaffAccess("campaigns")
  if (!access.ok) return { success: false, error: access.error }

  const enabledSlugs = await loadOrganizationEnabledModuleSlugs(access.orgId)
  if (!isOrganizationModuleEnabled(enabledSlugs, "event-management")) {
    return {
      success: false,
      error: "Event Management is not included in your subscription.",
    }
  }

  return writeLinkedCampaign({
    eventId: input.eventId,
    linkedCampaignId: input.campaignId,
  })
}

export async function unlinkEventFromCampaignAction(input: {
  eventId: string
}): Promise<{ success: true } | { success: false; error: string }> {
  const access = await requireDonationStaffAccess("campaigns")
  if (!access.ok) return { success: false, error: access.error }

  return writeLinkedCampaign({
    eventId: input.eventId,
    linkedCampaignId: null,
  })
}

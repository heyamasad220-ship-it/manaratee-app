"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { revalidateTicketingPaths } from "@/lib/tickets/revalidate-ticketing-paths"

import type { EventTicketType, EventTicketTypeInput } from "./ticket-types"

export async function getEventTicketTypes(
  internalEventId: string
): Promise<EventTicketType[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("event_ticket_types")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("internal_event_id", internalEventId)
    .order("sort_order")
    .order("created_at")

  if (error) {
    if (error.code === "42P01") return []
    console.error(error)
    throw new Error("Failed to load ticket types")
  }

  return (data || []) as EventTicketType[]
}

export async function syncEventTicketTypes(
  internalEventId: string,
  ticketTypes: EventTicketTypeInput[]
) {
  const canManage = await hasAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )
  if (!canManage) {
    throw new Error("You do not have permission to manage ticket types.")
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: existing, error: loadError } = await supabase
    .from("event_ticket_types")
    .select("id, quantity_sold")
    .eq("organization_id", organizationId)
    .eq("internal_event_id", internalEventId)

  if (loadError) {
    if (loadError.code === "42P01") return
    throw new Error(loadError.message || "Failed to load existing ticket types")
  }

  const existingRows = existing || []
  const keepIds = new Set(
    ticketTypes.map((type) => type.id).filter(Boolean) as string[]
  )

  for (const row of existingRows) {
    if (keepIds.has(row.id as string)) continue

    const sold = Number(row.quantity_sold || 0)
    if (sold > 0) {
      const { error: deactivateError } = await supabase
        .from("event_ticket_types")
        .update({ is_active: false })
        .eq("id", row.id)
        .eq("organization_id", organizationId)

      if (deactivateError) {
        throw new Error(deactivateError.message || "Failed to deactivate ticket type")
      }
      continue
    }

    const { error: deleteError } = await supabase
      .from("event_ticket_types")
      .delete()
      .eq("id", row.id)
      .eq("organization_id", organizationId)

    if (deleteError) {
      throw new Error(deleteError.message || "Failed to remove ticket type")
    }
  }

  for (const [index, type] of ticketTypes.entries()) {
    const payload = {
      organization_id: organizationId,
      internal_event_id: internalEventId,
      name: type.name.trim(),
      description: type.description?.trim() || null,
      price_cents: Math.max(0, type.priceCents),
      quantity_total: type.quantityTotal ?? null,
      sort_order: type.sortOrder ?? index,
      is_active: true,
    }

    if (type.id) {
      const { error } = await supabase
        .from("event_ticket_types")
        .update(payload)
        .eq("id", type.id)
        .eq("organization_id", organizationId)
        .eq("internal_event_id", internalEventId)

      if (error) {
        throw new Error(error.message || "Failed to update ticket type")
      }
    } else {
      const { error } = await supabase.from("event_ticket_types").insert(payload)

      if (error) {
        throw new Error(error.message || "Failed to create ticket type")
      }
    }
  }

  revalidatePath(`/event-management/${internalEventId}`)
  revalidatePath(`/event-management/${internalEventId}/edit`)
  revalidateTicketingPaths()
}

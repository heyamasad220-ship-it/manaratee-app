"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  calendarStatusFromVisibility,
  type BazaarCalendarVisibility,
} from "@/lib/vendor-hub/calendar-visibility"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import { publishBazaarEventNotifications } from "@/lib/vendor-hub/bazaar-event-lifecycle-actions"
import { createBazaarShareToken } from "@/lib/vendor-hub/bazaar-share-url"
import { isVisibleOnCommunityCalendar } from "@/lib/vendor-hub/calendar-visibility"

export type UpsertBazaarEventInput = {
  id?: string
  name: string
  event_type?: string | null
  event_date?: string | null
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  description?: string | null
  expected_attendees?: number | null
  total_booths?: number | null
  calendar_visibility: BazaarCalendarVisibility
  internal_event_id?: string | null
  flyer_url?: string | null
  organizer_contact_id?: string | null
  organizer_name?: string | null
  venue_id?: string | null
}

export type InternalEventLinkOption = {
  id: string
  name: string
  start_at: string | null
  status: string | null
}

export type BazaarVenueOption = {
  id: string
  name: string
}

function revalidateVendorHubEventPaths(eventId?: string) {
  revalidatePath(VENDOR_HUB_ROUTES.dashboard)
  revalidatePath(VENDOR_HUB_ROUTES.events.list)
  revalidatePath(VENDOR_HUB_ROUTES.communityCalendar)
  if (eventId) {
    revalidatePath(VENDOR_HUB_ROUTES.events.detail(eventId))
  }
}

export async function fetchInternalEventsForLinking(): Promise<InternalEventLinkOption[]> {
  await requireVendorHubManage()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("internal_events")
    .select("id, name, start_at, status")
    .eq("organization_id", organizationId)
    .order("start_at", { ascending: false, nullsFirst: false })
    .limit(100)

  if (error) {
    console.error("fetchInternalEventsForLinking error:", error)
    return []
  }

  return (data ?? []) as InternalEventLinkOption[]
}

export async function fetchVenuesForBazaarPicker(): Promise<BazaarVenueOption[]> {
  await requireVendorHubManage()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("venues")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })

  if (error) {
    console.error("fetchVenuesForBazaarPicker error:", error)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string) || "Untitled space",
  }))
}

export async function upsertBazaarEvent(input: UpsertBazaarEventInput) {
  await requireVendorHubManage()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const name = input.name.trim()
  if (!name) {
    throw new Error("Event name is required")
  }

  const internalEventId =
    input.internal_event_id && input.internal_event_id !== "none"
      ? input.internal_event_id
      : null

  if (internalEventId) {
    const { data: internalEvent, error: internalError } = await supabase
      .from("internal_events")
      .select("id")
      .eq("id", internalEventId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (internalError) {
      throw new Error(internalError.message)
    }

    if (!internalEvent) {
      throw new Error("Selected Event Management event was not found")
    }
  }

  const organizerContactId = input.organizer_contact_id?.trim() || null
  if (organizerContactId) {
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", organizerContactId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (contactError) {
      throw new Error(contactError.message)
    }

    if (!contact) {
      throw new Error("Selected primary contact was not found")
    }
  }

  const venueId = input.venue_id?.trim() || null
  if (venueId) {
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("id")
      .eq("id", venueId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (venueError) {
      throw new Error(venueError.message)
    }

    if (!venue) {
      throw new Error("Selected space was not found")
    }
  }

  const payload = {
    name,
    event_type: input.event_type?.trim() || null,
    event_date: input.event_date || null,
    start_time: input.start_time || null,
    end_time: input.end_time || null,
    location: input.location?.trim() || null,
    description: input.description?.trim() || null,
    expected_attendees: input.expected_attendees ?? 0,
    total_booths: input.total_booths ?? 0,
    status: "draft" as const,
    calendar_status: calendarStatusFromVisibility(input.calendar_visibility),
    organization_id: organizationId,
    internal_event_id: internalEventId,
    flyer_url: input.flyer_url?.trim() || null,
    organizer_contact_id: organizerContactId,
    organizer_name: input.organizer_name?.trim() || null,
    venue_id: venueId,
  }

  if (input.id) {
    const { data: existing, error: fetchError } = await supabase
      .from("vendor_hub_events")
      .select("id, organization_id, calendar_status, status")
      .eq("id", input.id)
      .maybeSingle()

    if (fetchError) {
      throw new Error(fetchError.message)
    }

    if (!existing) {
      throw new Error("Bazaar event not found")
    }

    if (existing.organization_id && existing.organization_id !== organizationId) {
      throw new Error("Bazaar event not found")
    }

    const { data, error } = await supabase
      .from("vendor_hub_events")
      .update({
        ...payload,
        status: (existing.status as string | null) ?? "draft",
      })
      .eq("id", input.id)
      .select("id")
      .single()

    if (error) {
      console.error("upsertBazaarEvent update error:", error)
      throw new Error(error.message || "Failed to update bazaar event")
    }

    revalidateVendorHubEventPaths(data.id)

    const wasVisible = isVisibleOnCommunityCalendar(existing.calendar_status as string | null)
    const nowVisible = isVisibleOnCommunityCalendar(payload.calendar_status as string)
    if (!wasVisible && nowVisible && organizationId) {
      try {
        await publishBazaarEventNotifications(data.id)
      } catch (notifyError) {
        console.error("publishBazaarEventNotifications:", notifyError)
      }
    }

    return { id: data.id }
  }

  const { data, error } = await supabase
    .from("vendor_hub_events")
    .insert({
      ...payload,
      public_share_token: createBazaarShareToken(),
    })
    .select("id")
    .single()

  if (error) {
    console.error("upsertBazaarEvent insert error:", error)
    throw new Error(error.message || "Failed to create bazaar event")
  }

  revalidateVendorHubEventPaths(data.id)

  if (isVisibleOnCommunityCalendar(payload.calendar_status as string) && organizationId) {
    try {
      await publishBazaarEventNotifications(data.id)
    } catch (notifyError) {
      console.error("publishBazaarEventNotifications:", notifyError)
    }
  }

  return { id: data.id }
}

export async function getBazaarEventDeleteBlockers(eventId: string): Promise<string | null> {
  await requireVendorHubManage()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return "No organization selected."
  }

  const trimmedId = eventId.trim()
  if (!trimmedId) return "Event id is required."

  const { data: existing, error: fetchError } = await supabase
    .from("vendor_hub_events")
    .select("id, organization_id")
    .eq("id", trimmedId)
    .maybeSingle()

  if (fetchError) return fetchError.message
  if (!existing || existing.organization_id !== organizationId) {
    return "Bazaar event not found."
  }

  const [assignmentsResult, paymentsResult] = await Promise.all([
    supabase
      .from("vendor_hub_booth_assignments")
      .select("id, status")
      .eq("event_id", trimmedId)
      .in("status", ["reserved", "assigned", "confirmed"]),
    supabase.from("vendor_hub_payments").select("id").eq("event_id", trimmedId).limit(1),
  ])

  if (assignmentsResult.error) return assignmentsResult.error.message
  if (paymentsResult.error) return paymentsResult.error.message

  const reservationCount = assignmentsResult.data?.length ?? 0
  const hasFinancialActivity = (paymentsResult.data?.length ?? 0) > 0

  if (reservationCount > 0 && hasFinancialActivity) {
    return "This event has booth reservations and payment activity. Remove those first before deleting."
  }
  if (reservationCount > 0) {
    return "This event has booth reservations. Remove them before deleting."
  }
  if (hasFinancialActivity) {
    return "This event has payment activity. Remove or refund payments before deleting."
  }

  return null
}

export async function deleteBazaarEvent(eventId: string) {
  await requireVendorHubManage()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const trimmedId = eventId.trim()
  if (!trimmedId) {
    throw new Error("Event id is required")
  }

  const blocker = await getBazaarEventDeleteBlockers(trimmedId)
  if (blocker) {
    throw new Error(blocker)
  }

  const { data: existing, error: fetchError } = await supabase
    .from("vendor_hub_events")
    .select("id, organization_id")
    .eq("id", trimmedId)
    .maybeSingle()

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  if (!existing || existing.organization_id !== organizationId) {
    throw new Error("Bazaar event not found")
  }

  const { error } = await supabase
    .from("vendor_hub_events")
    .delete()
    .eq("id", trimmedId)
    .eq("organization_id", organizationId)

  if (error) {
    console.error("deleteBazaarEvent error:", error)
    throw new Error(error.message || "Failed to delete bazaar event")
  }

  revalidateVendorHubEventPaths(trimmedId)
  return { ok: true as const }
}

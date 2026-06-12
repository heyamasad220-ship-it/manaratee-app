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
}

export type InternalEventLinkOption = {
  id: string
  name: string
  start_at: string | null
  status: string | null
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

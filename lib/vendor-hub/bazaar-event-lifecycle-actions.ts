"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { calendarStatusFromVisibility } from "@/lib/vendor-hub/calendar-visibility"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import { sendVendorEventAnnouncement } from "@/lib/vendor-hub/vendor-announcement-actions"

async function getEventForOrg(eventId: string) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data, error } = await supabase
    .from("vendor_hub_events")
    .select("id, name, organization_id, status, calendar_status")
    .eq("id", eventId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error || !data) {
    throw new Error("Bazaar event not found")
  }

  return { supabase, organizationId, event: data }
}

function revalidateEventPaths(eventId: string) {
  revalidatePath(VENDOR_HUB_ROUTES.events.list)
  revalidatePath(VENDOR_HUB_ROUTES.events.detail(eventId))
  revalidatePath(VENDOR_HUB_ROUTES.events.booths(eventId))
  revalidatePath(VENDOR_HUB_ROUTES.events.applications(eventId))
  revalidatePath(VENDOR_HUB_ROUTES.events.evaluations(eventId))
  revalidatePath(VENDOR_HUB_ROUTES.events.messages(eventId))
  revalidatePath(VENDOR_HUB_ROUTES.communityCalendar)
  revalidatePath("/customer/bazaars")
}

export async function closeBazaarEvent(eventId: string) {
  await requireVendorHubManage()

  const { supabase, event } = await getEventForOrg(eventId)

  if (event.status === "cancelled") {
    throw new Error("Cancelled events cannot be closed. Re-open by editing the event.")
  }

  if (event.status === "completed") {
    return { id: eventId, alreadyClosed: true as const }
  }

  const { error } = await supabase
    .from("vendor_hub_events")
    .update({
      status: "completed",
      calendar_status: calendarStatusFromVisibility("private"),
    })
    .eq("id", eventId)

  if (error) {
    throw new Error(error.message)
  }

  revalidateEventPaths(eventId)
  return { id: eventId, alreadyClosed: false as const }
}

export async function cancelBazaarEvent(input: {
  eventId: string
  reason?: string | null
  notifyVendors?: boolean
}) {
  await requireVendorHubManage()

  const { supabase, organizationId, event } = await getEventForOrg(input.eventId)

  const { error } = await supabase
    .from("vendor_hub_events")
    .update({
      status: "cancelled",
      calendar_status: calendarStatusFromVisibility("private"),
    })
    .eq("id", input.eventId)

  if (error) {
    throw new Error(error.message)
  }

  if (input.notifyVendors !== false) {
    const reason = input.reason?.trim()
    await sendVendorEventAnnouncement({
      eventId: input.eventId,
      organizationId,
      announcementType: "cancellation",
      audience: "event_participants",
      subject: `${event.name as string} has been cancelled`,
      body:
        reason ||
        `The bazaar "${event.name as string}" has been cancelled by the organizer. If you had a booth reservation, they will follow up with refund details.`,
    })
  }

  revalidateEventPaths(input.eventId)
  return { id: input.eventId }
}

export async function publishBazaarEventNotifications(eventId: string) {
  await requireVendorHubManage()

  const { organizationId, event } = await getEventForOrg(eventId)

  const calendarStatus = event.calendar_status as string | null
  if (
    calendarStatus !== "community_visible" &&
    calendarStatus !== "published"
  ) {
    throw new Error("Publish the event to the community calendar before notifying vendors.")
  }

  return sendVendorEventAnnouncement({
    eventId,
    organizationId,
    announcementType: "published",
    audience: "all_approved_vendors",
    subject: `New bazaar open for booth reservations: ${event.name as string}`,
    body: `A bazaar has been published and is open for booth reservations. Sign in to My Bazaars to reserve your booth and pay.`,
  })
}

"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { resolveCustomerPortalActor } from "@/lib/auth/customer-portal-session"
import { deliverVendorEventAnnouncement } from "@/lib/vendor-hub/vendor-announcement-delivery"
import type {
  VendorAnnouncementAudience,
  VendorAnnouncementRecord,
  VendorAnnouncementType,
  VendorInboxMessage,
} from "@/lib/vendor-hub/vendor-announcement-types"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

export async function fetchEventVendorAnnouncements(eventId: string) {
  await requireVendorHubManage()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return []
  }
  return getEventVendorAnnouncements(eventId, organizationId)
}

export async function sendVendorEventAnnouncement(input: {
  eventId: string
  organizationId: string
  announcementType: VendorAnnouncementType
  audience: VendorAnnouncementAudience
  subject: string
  body: string
}) {
  await requireVendorHubManage()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", input.organizationId)
    .maybeSingle()

  const result = await deliverVendorEventAnnouncement({
    supabase,
    eventId: input.eventId,
    organizationId: input.organizationId,
    announcementType: input.announcementType,
    audience: input.audience,
    subject: input.subject,
    body: input.body,
    sentBy: user?.id ?? null,
    organizationName: (org?.name as string | null) ?? null,
  })

  revalidatePath(VENDOR_HUB_ROUTES.events.messages(input.eventId))
  revalidatePath("/customer/bazaars")

  return {
    announcementId: result.announcementId,
    recipientCount: result.recipientCount,
    emailCount: result.emailCount,
    dispatched: result.dispatched,
  }
}

export async function getEventVendorAnnouncements(
  eventId: string,
  organizationId: string
): Promise<VendorAnnouncementRecord[]> {
  const supabase = await createClient()

  const { data: announcements, error } = await supabase
    .from("vendor_hub_announcements")
    .select("id, organization_id, vendor_hub_event_id, announcement_type, audience, subject, body, created_at")
    .eq("vendor_hub_event_id", eventId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    console.error("getEventVendorAnnouncements:", error)
    return []
  }

  if (!announcements?.length) {
    return []
  }

  const announcementIds = announcements.map((row) => row.id as string)
  const { data: recipientCounts } = await supabase
    .from("vendor_hub_announcement_recipients")
    .select("announcement_id")
    .in("announcement_id", announcementIds)

  const countByAnnouncement = new Map<string, number>()
  for (const row of recipientCounts ?? []) {
    const key = row.announcement_id as string
    countByAnnouncement.set(key, (countByAnnouncement.get(key) ?? 0) + 1)
  }

  const { data: event } = await supabase
    .from("vendor_hub_events")
    .select("name")
    .eq("id", eventId)
    .maybeSingle()

  return announcements.map((row) => ({
    id: row.id as string,
    organizationId: row.organization_id as string,
    eventId: row.vendor_hub_event_id as string,
    eventName: (event?.name as string) ?? "Bazaar event",
    announcementType: row.announcement_type as VendorAnnouncementType,
    audience: row.audience as VendorAnnouncementAudience,
    subject: row.subject as string,
    body: row.body as string,
    recipientCount: countByAnnouncement.get(row.id as string) ?? 0,
    createdAt: row.created_at as string,
  }))
}

export async function getVendorInboxMessages(): Promise<VendorInboxMessage[]> {
  const actor = await resolveCustomerPortalActor()

  if (!actor) {
    return []
  }

  const { userId, supabase } = actor

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id")
    .eq("auth_user_id", userId)

  const contactIds = (contacts ?? []).map((row) => row.id as string)
  if (contactIds.length === 0) {
    return []
  }

  const { data: recipientRows, error } = await supabase
    .from("vendor_hub_announcement_recipients")
    .select("id, announcement_id, contact_id, read_at, created_at")
    .in("contact_id", contactIds)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    console.error("getVendorInboxMessages:", error)
    return []
  }

  if (!recipientRows?.length) {
    return []
  }

  const announcementIds = [...new Set(recipientRows.map((row) => row.announcement_id as string))]

  const { data: announcements } = await supabase
    .from("vendor_hub_announcements")
    .select(
      "id, vendor_hub_event_id, organization_id, announcement_type, subject, body, created_at"
    )
    .in("id", announcementIds)

  const eventIds = [
    ...new Set((announcements ?? []).map((row) => row.vendor_hub_event_id as string)),
  ]
  const orgIds = [...new Set((announcements ?? []).map((row) => row.organization_id as string))]

  const [eventsResult, orgsResult] = await Promise.all([
    eventIds.length > 0
      ? supabase.from("vendor_hub_events").select("id, name").in("id", eventIds)
      : Promise.resolve({ data: [], error: null }),
    orgIds.length > 0
      ? supabase.from("organizations").select("id, name").in("id", orgIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const announcementById = new Map(
    (announcements ?? []).map((row) => [row.id as string, row])
  )
  const eventNameById = new Map(
    (eventsResult.data ?? []).map((row) => [row.id as string, row.name as string])
  )
  const orgNameById = new Map(
    (orgsResult.data ?? []).map((row) => [row.id as string, row.name as string])
  )

  return recipientRows
    .map((recipient) => {
      const announcement = announcementById.get(recipient.announcement_id as string)
      if (!announcement) return null

      const eventId = announcement.vendor_hub_event_id as string
      const organizationId = announcement.organization_id as string

      return {
        id: recipient.id as string,
        recipientId: recipient.id as string,
        announcementId: announcement.id as string,
        eventId,
        eventName: eventNameById.get(eventId) ?? "Bazaar event",
        organizationName: orgNameById.get(organizationId) ?? "Community organization",
        announcementType: announcement.announcement_type as VendorAnnouncementType,
        subject: announcement.subject as string,
        body: announcement.body as string,
        readAt: (recipient.read_at as string | null) ?? null,
        createdAt: (announcement.created_at as string) ?? (recipient.created_at as string),
      }
    })
    .filter(Boolean) as VendorInboxMessage[]
}

export async function markVendorInboxMessageRead(recipientId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("You must be signed in.")
  }

  const { error } = await supabase
    .from("vendor_hub_announcement_recipients")
    .update({ read_at: new Date().toISOString() })
    .eq("id", recipientId)
    .is("read_at", null)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/customer/bazaars")
}

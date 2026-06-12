"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { resolveCustomerPortalActor } from "@/lib/auth/customer-portal-session"
import {
  getApprovedVendorOrganizationsForAuthUser,
  getContactIdsForAuthUser,
} from "@/lib/vendor-hub/vendor-eligibility-queries"
import {
  isBazaarOpenForVendorReservation,
  type ReservableBazaarEvent,
  type ReservableBooth,
} from "@/lib/vendor-hub/vendor-participation-model"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

export async function getReservableBazaarEventsForCurrentUser(): Promise<
  ReservableBazaarEvent[]
> {
  const actor = await resolveCustomerPortalActor()

  if (!actor) {
    return []
  }

  const { userId, supabase } = actor

  const approvedOrgs = await getApprovedVendorOrganizationsForAuthUser(userId)
  if (approvedOrgs.length === 0) {
    return []
  }

  const orgIds = [...new Set(approvedOrgs.map((row) => row.organizationId))]
  const today = new Date().toISOString().slice(0, 10)

  const { data: events, error } = await supabase
    .from("vendor_hub_events")
    .select("id, organization_id, name, event_date, location, calendar_status, status")
    .in("organization_id", orgIds)
    .in("calendar_status", ["community_visible", "published"])
    .gte("event_date", today)
    .order("event_date", { ascending: true })

  if (error) {
    console.error("getReservableBazaarEventsForCurrentUser:", error)
    return []
  }

  const openEvents = (events ?? []).filter(
    (row) => row.status !== "completed" && row.status !== "cancelled"
  )

  const orgNameById = new Map(
    approvedOrgs.map((row) => [row.organizationId, row.organizationName])
  )

  const contactIds = approvedOrgs.map((row) => row.contactId)
  const eventIds = openEvents.map((row) => row.id as string)

  const assignedEventIds = new Set<string>()
  if (eventIds.length > 0) {
    const { data: assignments } = await supabase
      .from("vendor_hub_booth_assignments")
      .select("event_id")
      .in("contact_id", contactIds)
      .in("event_id", eventIds)
      .in("status", ["assigned", "confirmed", "reserved"])

    for (const row of assignments ?? []) {
      if (row.event_id) {
        assignedEventIds.add(row.event_id as string)
      }
    }
  }

  return (openEvents ?? [])
    .filter((row) => !assignedEventIds.has(row.id as string))
    .map((row) => ({
      id: row.id as string,
      organizationId: row.organization_id as string,
      organizationName: orgNameById.get(row.organization_id as string) ?? "Community organization",
      name: row.name as string,
      eventDate: (row.event_date as string | null) ?? null,
      location: (row.location as string | null) ?? null,
      calendarStatus: (row.calendar_status as string | null) ?? null,
    }))
}

export async function getAvailableBoothsForEvent(
  eventId: string
): Promise<ReservableBooth[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("You must be signed in.")
  }

  const { data: event, error: eventError } = await supabase
    .from("vendor_hub_events")
    .select("id, organization_id, calendar_status")
    .eq("id", eventId)
    .maybeSingle()

  if (eventError || !event) {
    throw new Error("Bazaar event not found.")
  }

  const contacts = await getContactIdsForAuthUser(supabase, user.id)
  const contact = contacts.find((row) => row.organization_id === event.organization_id)

  if (!contact) {
    throw new Error("You are not linked to this organization.")
  }

  const { isApprovedOrgVendor } = await import("@/lib/vendor-hub/vendor-eligibility-queries")
  const approved = await isApprovedOrgVendor({
    supabase,
    organizationId: event.organization_id as string,
    contactId: contact.id,
  })

  if (!approved) {
    throw new Error("You must be an approved vendor for this organization.")
  }

  if (!isBazaarOpenForVendorReservation(event.calendar_status as string | null)) {
    throw new Error("This bazaar is not open for reservations yet.")
  }

  const { data: booths, error: boothsError } = await supabase
    .from("vendor_hub_booths")
    .select("id, number, location, booth_type_id, status")
    .eq("event_id", eventId)
    .eq("status", "available")
    .order("number", { ascending: true })

  if (boothsError) {
    throw new Error(boothsError.message)
  }

  const boothTypeIds = [
    ...new Set(
      (booths ?? [])
        .map((row) => row.booth_type_id as string | null)
        .filter(Boolean) as string[]
    ),
  ]

  const boothTypeById = new Map<string, { name: string; price: number }>()
  if (boothTypeIds.length > 0) {
    const { data: boothTypes } = await supabase
      .from("vendor_hub_booth_types")
      .select("id, name, price")
      .in("id", boothTypeIds)

    for (const row of boothTypes ?? []) {
      boothTypeById.set(row.id as string, {
        name: row.name as string,
        price: Number(row.price ?? 0),
      })
    }
  }

  return (booths ?? []).map((row) => {
    const boothTypeId = row.booth_type_id as string | null
    const boothType = boothTypeId ? boothTypeById.get(boothTypeId) : null

    return {
      id: row.id as string,
      number: row.number as string,
      location: (row.location as string | null) ?? null,
      boothTypeId,
      boothTypeName: boothType?.name ?? null,
      feeAmount: boothType?.price ?? 0,
    }
  })
}

export async function reserveBoothForEvent(input: {
  eventId: string
  boothId: string
}): Promise<{ assignmentId: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("You must be signed in.")
  }

  const { data: assignmentId, error } = await supabase.rpc("reserve_vendor_booth", {
    p_event_id: input.eventId,
    p_booth_id: input.boothId,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/customer/bazaars")
  revalidatePath(VENDOR_HUB_ROUTES.events.detail(input.eventId))
  revalidatePath(VENDOR_HUB_ROUTES.events.booths(input.eventId))
  revalidatePath(VENDOR_HUB_ROUTES.events.applications(input.eventId))

  return { assignmentId: assignmentId as string }
}

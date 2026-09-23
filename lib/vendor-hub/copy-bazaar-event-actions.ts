"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import { calendarStatusFromVisibility } from "@/lib/vendor-hub/calendar-visibility"
import { createBazaarShareToken } from "@/lib/vendor-hub/bazaar-share-url"
import { ensureBazaarInternalEvent } from "@/lib/vendor-hub/ensure-bazaar-internal-event"

function boothNumberPrefix(name: string, sortOrder: number) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 4)
  if (slug.length >= 3) {
    return slug.toUpperCase()
  }
  return `B${sortOrder + 1}`
}

export type CopyBazaarEventInput = {
  sourceEventId: string
  name?: string
  eventDate?: string | null
  copyBoothSetup?: boolean
}

export async function copyBazaarEvent(input: CopyBazaarEventInput) {
  await requireVendorHubManage()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: source, error: sourceError } = await supabase
    .from("vendor_hub_events")
    .select("*")
    .eq("id", input.sourceEventId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (sourceError || !source) {
    throw new Error("Source bazaar event not found")
  }

  const copyName = input.name?.trim() || `${source.name as string} (Copy)`
  const calendarVisibility = "private" as const
  const sourceInternalEventId = (source.internal_event_id as string | null) || null
  let sourceVenueIds: string[] = []

  if (sourceInternalEventId) {
    const { data: venueLinks } = await supabase
      .from("internal_event_venues")
      .select("venue_id")
      .eq("organization_id", organizationId)
      .eq("internal_event_id", sourceInternalEventId)

    sourceVenueIds = (venueLinks || [])
      .map((row) => row.venue_id as string)
      .filter((id) => id.trim().length > 0)
  }

  if (sourceVenueIds.length === 0 && source.venue_id) {
    sourceVenueIds = [source.venue_id as string]
  }

  const internalEventId = await ensureBazaarInternalEvent({
    supabase,
    organizationId,
    identity: {
      name: copyName,
      description: (source.description as string | null) ?? null,
      eventDate: input.eventDate ?? null,
      startTime: (source.start_time as string | null) ?? null,
      endTime: (source.end_time as string | null) ?? null,
      location: (source.location as string | null) ?? null,
      flyerUrl: (source.flyer_url as string | null) ?? null,
      venueId: sourceVenueIds[0] ?? (source.venue_id as string | null) ?? null,
      venueIds: sourceVenueIds,
      calendarVisibility,
      coordinatorContactId: (source.organizer_contact_id as string | null) ?? null,
    },
  })

  const { data: newEvent, error: insertError } = await supabase
    .from("vendor_hub_events")
    .insert({
      organization_id: organizationId,
      name: copyName,
      event_type: source.event_type,
      event_date: input.eventDate ?? null,
      start_time: source.start_time,
      end_time: source.end_time,
      location: source.location,
      description: source.description,
      expected_attendees: source.expected_attendees ?? 0,
      total_booths: input.copyBoothSetup === false ? 0 : (source.total_booths ?? 0),
      status: "draft",
      calendar_status: calendarStatusFromVisibility(calendarVisibility),
      internal_event_id: internalEventId,
      flyer_url: source.flyer_url,
      venue_id: sourceVenueIds[0] ?? null,
      public_share_token: createBazaarShareToken(),
    })
    .select("id")
    .single()

  if (insertError || !newEvent) {
    throw new Error(insertError?.message || "Failed to copy bazaar event")
  }

  const newEventId = newEvent.id as string

  if (input.copyBoothSetup !== false) {
    const { data: boothTypes, error: typesError } = await supabase
      .from("vendor_hub_booth_types")
      .select("*")
      .eq("event_id", input.sourceEventId)
      .order("sort_order", { ascending: true })

    if (typesError) {
      throw new Error("Failed to read booth types from source event")
    }

    const typeIds = (boothTypes ?? []).map((row) => row.id as string)
    let totalBooths = 0

    const { data: typeAttributeLinks } =
      typeIds.length > 0
        ? await supabase
            .from("vendor_hub_booth_type_attributes")
            .select("booth_type_id, attribute_id")
            .in("booth_type_id", typeIds)
        : { data: [] }

    const attributeIdsByOldType = new Map<string, string[]>()
    for (const link of typeAttributeLinks ?? []) {
      const key = link.booth_type_id as string
      const list = attributeIdsByOldType.get(key) ?? []
      list.push(link.attribute_id as string)
      attributeIdsByOldType.set(key, list)
    }

    const { data: sourceBooths } = await supabase
      .from("vendor_hub_booths")
      .select("id, booth_type_id, number, location, notes")
      .eq("event_id", input.sourceEventId)
      .order("number", { ascending: true })

    const boothsByOldType = new Map<string, typeof sourceBooths>()
    for (const booth of sourceBooths ?? []) {
      const typeId = booth.booth_type_id as string | null
      if (!typeId) continue
      const list = boothsByOldType.get(typeId) ?? []
      list.push(booth)
      boothsByOldType.set(typeId, list)
    }

    for (const [index, boothType] of (boothTypes ?? []).entries()) {
      const oldTypeId = boothType.id as string

      const { data: newType, error: typeInsertError } = await supabase
        .from("vendor_hub_booth_types")
        .insert({
          event_id: newEventId,
          name: boothType.name,
          size: boothType.size,
          price: boothType.price,
          selection_fee: boothType.selection_fee ?? 0,
          color: boothType.color,
          description: boothType.description,
          capacity: boothType.capacity,
          location: boothType.location,
          is_active: boothType.is_active ?? true,
          sort_order: boothType.sort_order ?? index,
          default_booth_numbers: boothType.default_booth_numbers ?? [],
        })
        .select("id")
        .single()

      if (typeInsertError || !newType) {
        throw new Error(`Failed to copy booth type "${boothType.name as string}"`)
      }

      const attributeIds = attributeIdsByOldType.get(oldTypeId) ?? []
      if (attributeIds.length > 0) {
        await supabase.from("vendor_hub_booth_type_attributes").insert(
          attributeIds.map((attributeId) => ({
            booth_type_id: newType.id,
            attribute_id: attributeId,
          }))
        )
      }

      const boothsForType = boothsByOldType.get(oldTypeId) ?? []
      if (boothsForType.length > 0) {
        const boothRows = boothsForType.map((booth, boothIndex) => ({
          event_id: newEventId,
          booth_type_id: newType.id,
          number:
            (booth.number as string) ||
            `${boothNumberPrefix(boothType.name as string, index)}-${String(boothIndex + 1).padStart(2, "0")}`,
          location: booth.location,
          status: "available",
          vendor_name: null,
          notes: booth.notes,
        }))

        const { error: boothInsertError } = await supabase
          .from("vendor_hub_booths")
          .insert(boothRows)

        if (boothInsertError) {
          throw new Error(`Failed to copy booths for "${boothType.name as string}"`)
        }

        totalBooths += boothRows.length
      } else {
        const quantity = Math.max(1, Number(boothType.capacity ?? 1) || 1)
        const prefix = boothNumberPrefix(boothType.name as string, index)
        const boothRows = Array.from({ length: quantity }, (_, boothIndex) => ({
          event_id: newEventId,
          booth_type_id: newType.id,
          number: `${prefix}-${String(boothIndex + 1).padStart(2, "0")}`,
          location: boothType.location,
          status: "available",
          vendor_name: null,
          notes: null,
        }))

        const { error: boothInsertError } = await supabase
          .from("vendor_hub_booths")
          .insert(boothRows)

        if (boothInsertError) {
          throw new Error(`Failed to generate booths for "${boothType.name as string}"`)
        }

        totalBooths += boothRows.length
      }
    }

    await supabase
      .from("vendor_hub_events")
      .update({ total_booths: totalBooths })
      .eq("id", newEventId)
  }

  revalidatePath(VENDOR_HUB_ROUTES.events.list)
  revalidatePath(VENDOR_HUB_ROUTES.events.detail(newEventId))
  revalidatePath(VENDOR_HUB_ROUTES.events.booths(newEventId))
  revalidatePath("/event-management")
  revalidatePath(`/event-management/${internalEventId}`)

  return { id: newEventId, name: copyName }
}

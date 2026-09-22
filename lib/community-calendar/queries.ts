import { loadOrganizationEnabledModuleSlugs } from "@/lib/modules/dashboard-module-access-server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { createClient } from "@/lib/supabase/server"
import { isVisibleOnCommunityCalendar } from "@/lib/community-calendar/calendar-visibility"
import { canAccessCommunityCalendar } from "@/lib/community-calendar/access"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import { getVendorHubEventIdsByInternalEventIds } from "@/lib/vendor-hub/vendor-hub-internal-event-queries"
import {
  hasAnyPermission,
  PERMISSIONS,
} from "@/lib/permissions/permissions"

export type CommunityCalendarSource = "bazaar" | "event"

export type CommunityCalendarItem = {
  id: string
  source: CommunityCalendarSource
  name: string
  /** ISO date (YYYY-MM-DD) or null */
  eventDate: string | null
  startLabel: string | null
  location: string | null
  calendarStatus: string | null
  description: string | null
  href: string
}

function toDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 10) || null
  }
  return date.toISOString().slice(0, 10)
}

function formatTimeLabel(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

export async function getCommunityCalendarPageData(): Promise<{
  items: CommunityCalendarItem[]
  includeBazaar: boolean
  includeEvents: boolean
}> {
  const allowed = await canAccessCommunityCalendar()
  if (!allowed) {
    return { items: [], includeBazaar: false, includeEvents: false }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { items: [], includeBazaar: false, includeEvents: false }
  }

  const enabledSlugs = await loadOrganizationEnabledModuleSlugs(organizationId)
  const canEvents =
    (enabledSlugs.has("event-management") || enabledSlugs.has("vendor-hub")) &&
    (await hasAnyPermission(
      PERMISSIONS.EVENTS_VIEW,
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.VENDOR_HUB_VIEW,
      PERMISSIONS.VENDOR_HUB_MANAGE,
      PERMISSIONS.APPLICATIONS_VIEW
    ))

  const supabase = await createClient()
  const items: CommunityCalendarItem[] = []

  if (canEvents) {
    const { data, error } = await supabase
      .from("internal_events")
      .select(
        "id, name, start_at, location_label, location_address, community_calendar_status, description, source_module, venues:venue_id ( name )"
      )
      .eq("organization_id", organizationId)
      .order("start_at", { ascending: true, nullsFirst: false })

    if (
      error &&
      (error.message?.includes("community_calendar_status") ||
        error.code === "42703")
    ) {
      console.warn(
        "Community calendar: run scripts/247_internal_event_community_calendar.sql"
      )
    } else if (error) {
      console.error("Community calendar events load error:", error)
    } else {
      const bazaarByInternal = await getVendorHubEventIdsByInternalEventIds(
        organizationId,
        (data || []).map((row) => row.id as string)
      )
      let includeBazaarItems = false

      for (const row of data || []) {
        const status = (row as { community_calendar_status?: string | null })
          .community_calendar_status
        if (!isVisibleOnCommunityCalendar(status)) continue

        const venueEmbed = (row as { venues?: { name?: string } | { name?: string }[] | null })
          .venues
        const venueName = Array.isArray(venueEmbed)
          ? venueEmbed[0]?.name
          : venueEmbed?.name
        const location =
          venueName ||
          (row.location_label as string | null) ||
          (row.location_address as string | null) ||
          null

        const linkedBazaarId = bazaarByInternal.get(row.id as string)
        const isBazaarHold =
          (row as { source_module?: string | null }).source_module === "vendor_hub" &&
          Boolean(linkedBazaarId)
        const bazaarId = isBazaarHold ? linkedBazaarId : undefined
        if (bazaarId) includeBazaarItems = true

        items.push({
          id: bazaarId ? `bazaar:${bazaarId}` : `event:${row.id}`,
          source: bazaarId ? "bazaar" : "event",
          name: (row.name as string) || "Event",
          eventDate: toDateKey(row.start_at as string | null),
          startLabel: formatTimeLabel(row.start_at as string | null),
          location,
          calendarStatus: status ?? null,
          description: (row.description as string | null) ?? null,
          href: bazaarId
            ? VENDOR_HUB_ROUTES.events.detail(bazaarId)
            : `/event-management/${row.id}`,
        })
      }

      items.sort((a, b) => {
        const aDate = a.eventDate || "9999-99-99"
        const bDate = b.eventDate || "9999-99-99"
        if (aDate !== bDate) return aDate.localeCompare(bDate)
        return a.name.localeCompare(b.name)
      })

      return {
        items,
        includeBazaar: includeBazaarItems,
        includeEvents: canEvents,
      }
    }
  }

  items.sort((a, b) => {
    const aDate = a.eventDate || "9999-99-99"
    const bDate = b.eventDate || "9999-99-99"
    if (aDate !== bDate) return aDate.localeCompare(bDate)
    return a.name.localeCompare(b.name)
  })

  return {
    items,
    includeBazaar: items.some((item) => item.source === "bazaar"),
    includeEvents: canEvents,
  }
}
